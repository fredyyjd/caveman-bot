const crypto = require('crypto');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const config = require('../config');
const DECISION_COLORS = {
  accepted: 0x57f287, // Discord green
  denied: 0xed4245, // Discord red
};
const ticketStore = require('../utils/ticketStore');
const applicationQuestions = require('../data/applicationQuestions');
const { runApplicationFlow } = require('../utils/applicationFlow');
const { buildDecisionRow } = require('../utils/applicationDecision');
const { createPrivateChannel } = require('../utils/ticketCreation');
const { noClaimRow } = require('../utils/ticketActions');
const { PermissionFlagsBits } = require('discord.js');

// Applications (staff, builder, partner manager, media manager) are handled by
// HIGH STAFF only, NOT the regular staff team. High staff = Administrator, or
// the role pinged for applications (applicationCategories.<type>.pingRoleId),
// or config.alwaysCanTypeRoleId.
function isHighStaff(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const roleIds = new Set(
    Object.values(config.applicationCategories || {})
      .map((c) => c.pingRoleId)
      .filter(Boolean)
  );
  if (config.alwaysCanTypeRoleId) roleIds.add(config.alwaysCanTypeRoleId);
  return [...roleIds].some((id) => member.roles.cache.has(id));
}

async function handleApplicationSelect(interaction) {
  // Defer immediately, before any async work (channel fetch, DM send) —
  // interaction tokens expire after 3s, and those calls can easily take
  // longer than that, which was causing "Unknown interaction" (10062)
  // errors on the reply below. Every branch now uses editReply instead
  // of reply, since the interaction is already deferred.
  await interaction.deferReply({ ephemeral: true });

  const value = interaction.values[0];
  const appConfig = applicationQuestions[value];
  if (!appConfig) {
    return interaction.editReply({ content: 'Unknown application type.' });
  }

  const existing = ticketStore.findOpenByUser(interaction.user.id, value);
  if (existing) {
    return interaction.editReply({
      content: 'You already have an open application of this type — check your DMs with the bot to continue it.',
    });
  }

  const appCfg = config.applicationCategories[value] || {};
  if (!appCfg.reviewChannelId) {
    return interaction.editReply({
      content: "This application type isn't fully set up yet (no review channel configured) — ask an admin to check config.js.",
    });
  }

  const reviewChannel = await interaction.client.channels.fetch(appCfg.reviewChannelId).catch(() => null);
  if (!reviewChannel) {
    return interaction.editReply({
      content: "The review channel for this application type couldn't be found — ask an admin to check config.js.",
    });
  }

  const introEmbed = new EmbedBuilder()
    .setTitle(appConfig.label)
    .setDescription(
      `You'll be asked ${appConfig.questions.length} questions one at a time. Just type your answer here to move to the next one, or press Cancel at any point to stop.`
    )
    .setColor(0x2b2d31);

  let dmChannel;
  try {
    dmChannel = await interaction.user.createDM();
    await dmChannel.send({ embeds: [introEmbed] });
  } catch (err) {
    return interaction.editReply({
      content: "I couldn't DM you to start the application — please enable direct messages from server members in your Privacy Settings and try again.",
    });
  }

  await interaction.editReply({ content: "Check your DMs — I've started your application there!" });

  const appId = crypto.randomUUID();
  ticketStore.add(appId, {
    type: 'application',
    category: value,
    openerId: interaction.user.id,
    openedAt: Date.now(),
  });

  runApplicationFlow(dmChannel, interaction.user, appConfig, {
    reviewChannel,
    pingRoleId: appCfg.pingRoleId,
    appId,
  }).catch((err) => {
    console.error('Application flow error:', err);
  });
}

function getAppId(interaction) {
  return interaction.customId.split(':')[1];
}

function reasonModal(customId, title) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('Reason')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000);
  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
  return modal;
}

// Builds the "<applicant>'s submission has been <accepted/denied> successfully
// by <staff>" line used both as the public confirmation and as the text
// stamped on the review message once the buttons are disabled. Appends a
// Reason line underneath when one was given.
//
// The mentions (<@id>) are left as literal ASCII so Discord renders them —
// (previously the surrounding bot-authored words got a bold-Unicode treatment)
// The reason itself is staff-typed text and is left exactly as written.
function decisionMessage(action, meta, actor, reason) {
  let msg = `<@${meta.openerId}>'s submission has been **${action}** successfully by ${actor}.`;
  if (reason) msg += `\n**Reason:** ${reason}`;
  return msg;
}

// Disables every button on the review message and stamps it with the final
// decision (and reason, if one was given). Works for both a plain button
// interaction and a modal-submit interaction — both expose `.message`.
async function finalizeDecision(interaction, action, meta, reason) {
  const disabledRow = buildDecisionRow(getAppId(interaction), { disabled: true });
  const content = decisionMessage(action, meta, interaction.user, reason);

  const [existingEmbed] = interaction.message.embeds;
  const color = DECISION_COLORS[action];
  const embeds =
    existingEmbed && color !== undefined
      ? [EmbedBuilder.from(existingEmbed).setColor(color)]
      : undefined;

  await interaction.message
    .edit({ content, components: [disabledRow], ...(embeds ? { embeds } : {}) })
    .catch(() => {});
}

// Looks up the application behind a button/modal. Normally it's in
// data/tickets.json, but if that record is missing (file reset, bot moved,
// restart, etc.) it is REBUILT from the submission embed on the review
// message itself (title, "User ID" footer, answers), so Accept / Deny /
// Open a Ticket keep working instead of failing.
function rebuildApplicationFromMessage(message) {
  const embed = message && message.embeds && message.embeds[0];
  if (!embed || !embed.title || !embed.title.endsWith(' — Submission')) return null;

  const label = embed.title.replace(/ — Submission$/, '');
  const categoryKey = Object.keys(applicationQuestions).find(
    (key) => applicationQuestions[key].label === label
  );
  if (!categoryKey) return null;

  const openerId = ((embed.footer && embed.footer.text) || '').match(/\d{17,20}/)?.[0];
  if (!openerId) return null;

  const answers = (embed.description || '')
    .split(/\n\n(?=\*\*\d+\. )/)
    .map((part) => part.match(/^\*\*\d+\. ([\s\S]*?)\*\*\n([\s\S]*)$/))
    .filter(Boolean)
    .map((m) => ({ question: m[1], answer: m[2] }));

  return {
    type: 'application',
    category: categoryKey,
    openerId,
    openedAt: message.createdTimestamp || Date.now(),
    answers,
  };
}

function getOpenApplication(interaction) {
  const appId = getAppId(interaction);
  let meta = ticketStore.get(appId);

  if (!meta || meta.type !== 'application') {
    meta = rebuildApplicationFromMessage(interaction.message);
    if (!meta) return { appId, meta: null };
    ticketStore.add(appId, meta);
  }

  return { appId, meta };
}

// Builds the DM embed sent to the applicant once staff make a decision —
// green "Application Accepted" or red "Application Denied", naming the
// application type and the staff member who decided it. Denials also note
// the 1-week reapply wait. A Reason field is added underneath when staff
// gave one.
function applicantDecisionEmbed(action, meta, actor, reason) {
  const appConfig = applicationQuestions[meta.category];
  const label = appConfig ? appConfig.label : 'your application';

  const embed = new EmbedBuilder()
    .setColor(DECISION_COLORS[action])
    .setTitle(action === 'accepted' ? 'Application Accepted' : 'Application Denied')
    .setDescription(
      action === 'accepted'
        ? `Your application for "${label}" has been accepted by ${actor}.`
        : `Your application for "${label}" has been denied by ${actor}. You can reapply in 1 week.`
    );

  if (reason) embed.addFields({ name: 'Reason', value: reason });

  return embed;
}

async function processAccept(interaction, appId, meta, reason) {
  const appCfg = config.applicationCategories[meta.category] || {};
  const roleId = appCfg.acceptedRoleId;
  let roleNote = '';

  if (roleId) {
    try {
      const member = await interaction.guild.members.fetch(meta.openerId);
      await member.roles.add(roleId);
      roleNote = ` <@&${roleId}> has been given to <@${meta.openerId}>.`;
    } catch (err) {
      console.error('Failed to add accepted role:', err);
      roleNote = ' (Could not assign the accepted role automatically — check bot role position/permissions.)';
    }
  }

  await interaction.editReply(decisionMessage('accepted', meta, interaction.user, reason) + roleNote);
  await finalizeDecision(interaction, 'accepted', meta, reason);
  ticketStore.remove(appId);

  try {
    const applicant = await interaction.client.users.fetch(meta.openerId);
    await applicant.send({ embeds: [applicantDecisionEmbed('accepted', meta, interaction.user, reason)] });
  } catch {
    // Applicant has DMs closed — nothing more we can do.
  }
}

async function processDeny(interaction, appId, meta, reason) {
  await interaction.reply(decisionMessage('denied', meta, interaction.user, reason));
  await finalizeDecision(interaction, 'denied', meta, reason);
  ticketStore.remove(appId);

  try {
    const applicant = await interaction.client.users.fetch(meta.openerId);
    await applicant.send({ embeds: [applicantDecisionEmbed('denied', meta, interaction.user, reason)] });
  } catch {
    // Applicant has DMs closed — nothing more we can do.
  }
}

async function handleApplicationAccept(interaction) {
  if (!isHighStaff(interaction.member)) {
    return interaction.reply({ content: 'Only high staff can accept/deny applications.', ephemeral: true });
  }
  const { appId, meta } = getOpenApplication(interaction);
  if (!meta) {
    return interaction.reply({ content: 'This application is no longer available (already handled, or the bot restarted).', ephemeral: true });
  }
  await interaction.deferReply();
  await processAccept(interaction, appId, meta, null);
}

async function handleApplicationAcceptReason(interaction) {
  if (!isHighStaff(interaction.member)) {
    return interaction.reply({ content: 'Only high staff can accept/deny applications.', ephemeral: true });
  }
  const { appId, meta } = getOpenApplication(interaction);
  if (!meta) {
    return interaction.reply({ content: 'This application is no longer available (already handled, or the bot restarted).', ephemeral: true });
  }
  await interaction.showModal(reasonModal(`application_accept_reason_modal:${appId}`, 'Accept with Reason'));
}

async function handleApplicationAcceptReasonModal(interaction) {
  if (!isHighStaff(interaction.member)) {
    return interaction.reply({ content: 'Only high staff can accept/deny applications.', ephemeral: true });
  }
  const { appId, meta } = getOpenApplication(interaction);
  if (!meta) {
    return interaction.reply({ content: 'This application is no longer available (already handled, or the bot restarted).', ephemeral: true });
  }
  await interaction.deferReply();
  const reason = interaction.fields.getTextInputValue('reason');
  await processAccept(interaction, appId, meta, reason);
}

async function handleApplicationDeny(interaction) {
  if (!isHighStaff(interaction.member)) {
    return interaction.reply({ content: 'Only high staff can accept/deny applications.', ephemeral: true });
  }
  const { appId, meta } = getOpenApplication(interaction);
  if (!meta) {
    return interaction.reply({ content: 'This application is no longer available (already handled, or the bot restarted).', ephemeral: true });
  }
  await processDeny(interaction, appId, meta, null);
}

async function handleApplicationDenyReason(interaction) {
  if (!isHighStaff(interaction.member)) {
    return interaction.reply({ content: 'Only high staff can accept/deny applications.', ephemeral: true });
  }
  const { appId, meta } = getOpenApplication(interaction);
  if (!meta) {
    return interaction.reply({ content: 'This application is no longer available (already handled, or the bot restarted).', ephemeral: true });
  }
  await interaction.showModal(reasonModal(`application_deny_reason_modal:${appId}`, 'Deny with Reason'));
}

async function handleApplicationDenyReasonModal(interaction) {
  if (!isHighStaff(interaction.member)) {
    return interaction.reply({ content: 'Only high staff can accept/deny applications.', ephemeral: true });
  }
  const { appId, meta } = getOpenApplication(interaction);
  if (!meta) {
    return interaction.reply({ content: 'This application is no longer available (already handled, or the bot restarted).', ephemeral: true });
  }
  const reason = interaction.fields.getTextInputValue('reason');
  await processDeny(interaction, appId, meta, reason);
}

// "Open a Ticket" — pulls the applicant into a private ticket channel under
// the category configured for their application type (config.js ->
// applicationCategories.<type>.ticketCategoryId), pinging the same role that
// gets pinged for that application type. This ticket has no Claim button.
async function handleApplicationOpenTicket(interaction) {
  if (!isHighStaff(interaction.member)) {
    return interaction.reply({ content: 'Only high staff can open a ticket for an application.', ephemeral: true });
  }

  const { appId, meta } = getOpenApplication(interaction);
  if (!meta) {
    return interaction.reply({ content: 'This application is no longer available (already handled, or the bot restarted).', ephemeral: true });
  }

  if (meta.ticketChannelId) {
    return interaction.reply({
      content: `A ticket is already open for this application: <#${meta.ticketChannelId}>`,
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const appConfig = applicationQuestions[meta.category];
  const appCfg = config.applicationCategories[meta.category] || {};
  const applicant = await interaction.client.users.fetch(meta.openerId).catch(() => null);

  const { channel, rolesWithAccess } = await createPrivateChannel({
    guild: interaction.guild,
    name: `${appConfig.prefix}-${applicant ? applicant.username : meta.openerId}`,
    parentId: appCfg.ticketCategoryId,
    openerId: meta.openerId,
    // High staff only - the regular staff team (config.staffRoleId) must NOT see application tickets.
    roleIds: [appCfg.pingRoleId || config.alwaysCanTypeRoleId],
  });

  // Question text is bot-authored, and answers are wrapped in markdown; each answer is the
  // applicant's own typed text and is left exactly as they wrote it.
  const answersBlock = (meta.answers || [])
    .map((a, i) => `**${`${i + 1}. ${a.question}`}**\n${a.answer}`)
    .join('\n\n');

  const embed = new EmbedBuilder()
    .setTitle(`${appConfig.label} — Ticket`)
    .setDescription(
      `<@${meta.openerId}>, staff have opened a ticket to follow up on your application.${answersBlock ? `\n\n${answersBlock}` : ''}`
    )
    .setColor(0x2b2d31);

  // No Claim button here on purpose — application ticket, not a support ticket.
  const closeRow = noClaimRow();

  const pings = [`<@${meta.openerId}>`];
  if (appCfg.pingRoleId) pings.push(`<@&${appCfg.pingRoleId}>`);

  await channel.send({ content: pings.join(' '), embeds: [embed], components: [closeRow] });

  ticketStore.add(channel.id, {
    type: 'ticket',
    category: `${meta.category}_application`,
    openerId: meta.openerId,
    openedAt: Date.now(),
    rolesWithAccess,
    claimedBy: null,
  });

  ticketStore.update(appId, { ticketChannelId: channel.id });

  await interaction.message.edit({ components: [buildDecisionRow(appId, { ticketOpened: true })] }).catch(() => {});

  await interaction.editReply(`Ticket created: ${channel}`);
}

module.exports = {
  handleApplicationSelect,
  handleApplicationAccept,
  handleApplicationAcceptReason,
  handleApplicationAcceptReasonModal,
  handleApplicationDeny,
  handleApplicationDenyReason,
  handleApplicationDenyReasonModal,
  handleApplicationOpenTicket,
};

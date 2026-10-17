
require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  ActivityType,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');

const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
} = require('@discordjs/voice');

const PREFIX = 'r!';
const OWNER_ID = process.env.OWNER_ID;
const GUILD_ID = process.env.GUILD_ID;
const INITIAL_VC_ID = process.env.VC_CHANNEL_ID;

const AUTO_REPLY = 'NA ROYY BUSY GAA UNNADUU ANTI PANI 😎🔥';

if (!process.env.TOKEN || !OWNER_ID || !GUILD_ID) {
  console.error('❌ Fill TOKEN, OWNER_ID and GUILD_ID in .env');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

let selectedChannelId = INITIAL_VC_ID || null;
let autoReconnect = Boolean(INITIAL_VC_ID);
let voiceConnecting = false;

// ================ VOICE CONNECTION ================

async function ensureVoiceConnection() {
  if (
    voiceConnecting ||
    !client.isReady() ||
    !autoReconnect ||
    !selectedChannelId
  ) return;

  voiceConnecting = true;

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const channel = await guild.channels
      .fetch(selectedChannelId)
      .catch(() => null);

    if (
      !channel ||
      ![
        ChannelType.GuildVoice,
        ChannelType.GuildStageVoice,
      ].includes(channel.type)
    ) {
      console.error('❌ Selected VC is invalid.');
      autoReconnect = false;
      selectedChannelId = null;
      return;
    }

    const permissions = channel.permissionsFor(client.user);

    if (
      !permissions?.has(PermissionFlagsBits.ViewChannel) ||
      !permissions?.has(PermissionFlagsBits.Connect)
    ) {
      console.error('❌ Bot needs View Channel and Connect permissions.');
      return;
    }

    let connection = getVoiceConnection(GUILD_ID);

    if (connection) {
      const sameChannel =
        connection.joinConfig.channelId === selectedChannelId;

      const active = [
        VoiceConnectionStatus.Ready,
        VoiceConnectionStatus.Connecting,
        VoiceConnectionStatus.Signalling,
      ].includes(connection.state.status);

      if (sameChannel && active) return;

      connection.destroy();
    }

    connection = joinVoiceChannel({
      channelId: selectedChannelId,
      guildId: GUILD_ID,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true,
    });

    connection.on('error', (error) => {
      console.error('Voice connection error:', error.message);
    });

    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log(`🎧 Connected to VC: ${selectedChannelId}`);
    });
  } catch (error) {
    console.error('Voice error:', error.message);
  } finally {
    voiceConnecting = false;
  }
}

async function selectVoiceChannel(channelId) {
  selectedChannelId = channelId;
  autoReconnect = true;

  const oldConnection = getVoiceConnection(GUILD_ID);
  if (oldConnection) oldConnection.destroy();

  await ensureVoiceConnection();
}

// ================ BOT READY ================

client.once('ready', async () => {
  console.log(`🤖 Online as ${client.user.tag}`);

  client.user.setPresence({
    status: 'online',
    activities: [
      {
        name: 'Royy is the owner 💗',
        type: ActivityType.Watching,
      },
    ],
  });

  if (selectedChannelId) await ensureVoiceConnection();

  setInterval(() => {
    ensureVoiceConnection().catch(console.error);
  }, 20000);
});

// ================ MESSAGE HANDLER ================

client.on('messageCreate', async (message) => {
  if (!message.inGuild() || message.author.bot) return;

  const content = message.content.trim();
  const isOwner = message.author.id === OWNER_ID;

  // Automatic reply when someone mentions the owner.
  if (
    !isOwner &&
    !content.startsWith(PREFIX) &&
    message.mentions.users.has(OWNER_ID)
  ) {
    await message.reply({
      content: AUTO_REPLY,
      allowedMentions: { repliedUser: false },
    }).catch(console.error);

    return;
  }

  if (!content.toLowerCase().startsWith(PREFIX)) return;

  const args = content.slice(PREFIX.length).trim().split(/\s+/);
  const command = (args.shift() || '').toLowerCase();

  const ownerCommands = [
    'help',
    'join',
    'leave',
    'vc',
    'status',
    'activity',
    'bio',
    'announce',
  ];

  const isAdmin = message.member.permissions.has(
    PermissionFlagsBits.Administrator
  );

  // Only the bot owner or a server Administrator can use these commands.
  if (ownerCommands.includes(command) && !isOwner && !isAdmin) {
    return message.reply(
      '🔒 Bot Owner or Administrator permission required!'
    );
  }

  // ================ HELP ================

  if (command === 'help') {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🤖 OwnerBot Commands')
      .setDescription([
        '**🎧 Voice**',
        '`r!join` — Join your current VC',
        '`r!join #voice-channel` — Join a selected VC',
        '`r!leave` — Leave VC and disable reconnect',
        '`r!vc` — Reconnect to selected VC',
        '',
        '**👑 Status**',
        '`r!status online`',
        '`r!status idle`',
        '`r!status dnd`',
        '`r!status invisible`',
        '`r!status reset`',
        '`r!status show`',
        '`r!status text Your text`',
        '`r!status profile Your text`',
        '',
        '**✨ Activity**',
        '`r!activity playing GTA V`',
        '`r!activity watching Royy`',
        '`r!activity listening Music`',
        '`r!activity competing Tournament`',
        '`r!activity streaming YouTube`',
        '`r!activity clear`',
        '`r!bio Your text`',
        '',
        '**📢 Announcement**',
        '`r!announce #channel | title | message`',
        '',
        '**🔐 Permissions**',
        'Bot Owner or Administrator permission required.',
      ].join('\n'))
      .setFooter({ text: 'OwnerBot • Admin controls' });

    return message.reply({ embeds: [embed] });
  }

  // ================ JOIN VC ================

  if (command === 'join') {
    let channel = null;

    if (args.length === 0) {
      const member = await message.guild.members
        .fetch(message.author.id)
        .catch(() => null);

      if (!member?.voice?.channel) {
        return message.reply(
          '❌ Join a voice channel first, or use `r!join #voice-channel`.'
        );
      }

      channel = member.voice.channel;
    } else {
      const match = args[0].match(/^<#(\d+)>$/);
      const channelId = match ? match[1] : args[0];

      if (!/^\d{17,20}$/.test(channelId)) {
        return message.reply(
          '❌ Use `r!join` or `r!join #voice-channel`.'
        );
      }

      channel = await message.guild.channels
        .fetch(channelId)
        .catch(() => null);
    }

    if (
      !channel ||
      ![
        ChannelType.GuildVoice,
        ChannelType.GuildStageVoice,
      ].includes(channel.type)
    ) {
      return message.reply('❌ Choose a valid voice channel in this server.');
    }

    const permissions = channel.permissionsFor(client.user);

    if (
      !permissions?.has(PermissionFlagsBits.ViewChannel) ||
      !permissions?.has(PermissionFlagsBits.Connect)
    ) {
      return message.reply(
        '❌ Bot needs View Channel and Connect permissions in that VC.'
      );
    }

    await selectVoiceChannel(channel.id);

    return message.reply(
      `🎧 Selected VC: <#${channel.id}>\n` +
      '💗 I will periodically try to reconnect while running.'
    );
  }

  // ================ LEAVE VC ================

  if (command === 'leave') {
    autoReconnect = false;
    selectedChannelId = null;

    const connection = getVoiceConnection(GUILD_ID);
    if (connection) connection.destroy();

    return message.reply(
      '👋 Left VC. Automatic reconnection is disabled.'
    );
  }

  // ================ RECONNECT SELECTED VC ================

  if (command === 'vc') {
    if (!selectedChannelId) {
      return message.reply(
        '❌ No VC selected. Use `r!join` or `r!join #voice-channel`.'
      );
    }

    autoReconnect = true;
    await ensureVoiceConnection();

    return message.reply(
      `🎧 Checking selected VC: <#${selectedChannelId}>`
    );
  }

  // ================ STATUS ================

  if (command === 'status') {
    const sub = (args.shift() || '').toLowerCase();

    if (sub === 'show') {
      const activity = client.user.presence.activities[0];

      return message.reply(
        `🤖 **Status:** ${client.user.presence.status}\n` +
        `✨ **Activity:** ${activity?.name || 'None'}`
      );
    }

    if (sub === 'reset') {
      client.user.setPresence({
        status: 'online',
        activities: [],
      });

      return message.reply('✅ Status reset to online.');
    }

    if (sub === 'text' || sub === 'profile') {
      const text = args.join(' ');

      if (!text) {
        return message.reply(
          `Use: \`r!status ${sub} Royy is the owner 👑\``
        );
      }

      if (text.length > 128) {
        return message.reply('❌ Activity text must be 128 characters or fewer.');
      }

      client.user.setActivity(text, {
        type: ActivityType.Playing,
      });

      return message.reply(`✅ Activity updated: **${text}**`);
    }

    const statuses = ['online', 'idle', 'dnd', 'invisible'];

    if (!statuses.includes(sub)) {
      return message.reply(
        'Use `r!status online`, `idle`, `dnd`, `invisible`, ' +
        '`reset`, `show`, or `profile Your text`.'
      );
    }

    client.user.setStatus(sub);
    return message.reply(`✅ Status set to **${sub}**.`);
  }

  // ================ ACTIVITY ================

  if (command === 'activity') {
    const type = (args.shift() || '').toLowerCase();

    if (type === 'clear') {
      client.user.setActivity(null);
      return message.reply('✅ Activity cleared.');
    }

    const activityTypes = {
      playing: ActivityType.Playing,
      watching: ActivityType.Watching,
      listening: ActivityType.Listening,
      competing: ActivityType.Competing,
    };

    const text = args.join(' ').trim();

    if (type === 'streaming') {
      if (!text) {
        return message.reply('Use: `r!activity streaming YouTube`');
      }

      client.user.setActivity(text, {
        type: ActivityType.Streaming,
        url: 'https://www.twitch.tv/discord',
      });

      return message.reply(`📺 Streaming activity set to **${text}**.`);
    }

    if (!Object.hasOwn(activityTypes, type)) {
      return message.reply(
        'Use playing, watching, listening, competing, streaming, or clear.'
      );
    }

    if (!text) {
      return message.reply('❌ Enter some activity text.');
    }

    if (text.length > 128) {
      return message.reply('❌ Activity text must be 128 characters or fewer.');
    }

    client.user.setActivity(text, { type: activityTypes[type] });

    return message.reply(`✅ Activity set: **${type} ${text}**`);
  }

  // ================ CUSTOM ACTIVITY ================

  if (command === 'bio') {
    const text = args.join(' ').trim();

    if (!text) {
      return message.reply('Use: `r!bio Royy is the owner 💗`');
    }

    if (text.length > 128) {
      return message.reply('❌ Maximum 128 characters.');
    }

    client.user.setActivity(text, {
      type: ActivityType.Custom,
    });

    return message.reply(
      '✅ Custom activity requested. This does not change the bot account bio.'
    );
  }

  // ================ ANNOUNCEMENT ================

  if (command === 'announce') {
    const raw = content.slice(PREFIX.length + command.length).trim();
    const parts = raw.split('|').map((part) => part.trim());

    if (parts.length < 3) {
      return message.reply(
        'Format: `r!announce #channel | title | message`'
      );
    }

    const match = parts[0].match(/^<#(\d+)>$/);
    const channelId = match ? match[1] : parts[0];

    if (!/^\d{17,20}$/.test(channelId)) {
      return message.reply('❌ Mention a text channel or provide its ID.');
    }

    const title = parts[1];
    const announcement = parts.slice(2).join(' | ');

    const channel = await message.guild.channels
      .fetch(channelId)
      .catch(() => null);

    if (!channel || channel.type !== ChannelType.GuildText) {
      return message.reply('❌ Invalid text channel.');
    }

    if (!title || !announcement) {
      return message.reply('❌ Title and message are required.');
    }

    const permissions = channel.permissionsFor(client.user);

    if (
      !permissions?.has(PermissionFlagsBits.ViewChannel) ||
      !permissions?.has(PermissionFlagsBits.SendMessages) ||
      !permissions?.has(PermissionFlagsBits.EmbedLinks)
    ) {
      return message.reply(
        '❌ Bot needs View Channel, Send Messages and Embed Links.'
      );
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(title.slice(0, 256))
      .setDescription(announcement.slice(0, 4000))
      .setFooter({ text: `Announcement by ${message.author.username}` })
      .setTimestamp();

    try {
      await channel.send({
        embeds: [embed],
        allowedMentions: { parse: [] },
      });

      return message.reply(`✅ Announcement sent to <#${channel.id}>.`);
    } catch (error) {
      console.error('Announcement error:', error);
      return message.reply('❌ Could not send announcement.');
    }
  }
});

// ================ ERROR HANDLING ================

client.on('error', (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});

client.login(process.env.TOKEN);

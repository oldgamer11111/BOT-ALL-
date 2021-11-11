const { MessageEmbed, Message, CommandInteraction, CommandInteractionOptionResolver } = require("discord.js");
const { Command } = require("@src/structures");
const { MESSAGES, EMBED_COLORS } = require("@root/config.js");
const { getJson } = require("@utils/httpUtils");
const timestampToDate = require("timestamp-to-date");

module.exports = class CovidCommand extends Command {
  constructor(client) {
    super(client, {
      name: "covid",
      description: "get covid statistics for a country",
      cooldown: 5,
      category: "UTILITY",
      botPermissions: ["EMBED_LINKS"],
      command: {
        enabled: true,
        usage: "<country>",
        minArgsCount: 1,
      },
      slashCommand: {
        enabled: true,
        options: [
          {
            name: "country",
            description: "country name to get covid statistics for",
            type: "STRING",
            required: true,
          },
        ],
      },
    });
  }

  /**
   * @param {Message} message
   * @param {string[]} args
   */
  async messageRun(message, args) {
    const country = args[0];
    const response = await getCovid(country);
    message.channel.send(response);
  }

  /**
   * @param {CommandInteraction} interaction
   * @param {CommandInteractionOptionResolver} options
   */
  async interactionRun(interaction, options) {
    const country = options.getString("country");
    const response = await getCovid(country);
    interaction.followUp(response);
  }
};

async function getCovid(country) {
  const response = await getJson(`https://disease.sh/v2/countries/${country}`);

  if (response.status === 404) return "```css\nCountry with the provided name is not found```";
  if (!response.success) return MESSAGES.API_ERROR;
  const { data } = embed;

  const mg = timestampToDate(data?.updated, "dd.MM.yyyy at HH:mm");
  const embed = new MessageEmbed()
    .setTitle(`Covid - ${data?.country}`)
    .setThumbnail(data?.countryInfo.flag)
    .setColor(EMBED_COLORS.BOT_EMBED)
    .addField("Cases total", data?.cases.toString(), true)
    .addField("Cases today", data?.todayCases.toString(), true)
    .addField("Total deaths", data?.deaths.toString(), true)
    .addField("Deaths today", data?.todayDeaths.toString(), true)
    .addField("Recovered", data?.recovered.toString(), true)
    .addField("Active", data?.active.toString(), true)
    .addField("Critical stage", data?.critical.toString(), true)
    .addField("Cases per 1 million", data?.casesPerOneMillion.toString(), true)
    .addField("Deaths per 1 million", data?.deathsPerOneMillion.toString(), true)
    .setFooter(`Last updated on ${mg}`);

  return { embeds: [embed] };
}
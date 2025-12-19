const gtts = require("gtts");
const logger = require("../utils/logger");

const synthesizeText = async (text, languageCode = "en") => {
  try {
    const lang = languageCode.split("-")[0];
    return new Promise((resolve, reject) => {
      const speech = new gtts(text, lang);
      const chunks = [];

      speech
        .stream()
        .on("data", (chunk) => chunks.push(chunk))
        .on("end", () => {
          logger.info("Speech synthesis completed");
          resolve(Buffer.concat(chunks));
        })
        .on("error", reject);
    });
  } catch (error) {
    logger.error("GTTS error:", error);
    throw error;
  }
};

const listVoices = async () => [
  { languageCode: "en", name: "English" },
  { languageCode: "es", name: "Spanish" },
  { languageCode: "fr", name: "French" },
];

module.exports = { synthesizeText, listVoices };

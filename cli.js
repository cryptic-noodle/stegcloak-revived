#!/usr/bin/env node

// CLI TOOL — full of side-effects!

import { program } from "commander";
import StegCloak from "./stegcloak.js";
import chalk from "chalk";
import clipboardy from "clipboardy";
import inquirer from "inquirer";
import ora from "ora";
import { readFileSync, writeFileSync } from "fs";
import { readFile as readFileJson } from "jsonfile";
import { detach, decodeBase6, ZWC, FLAG_ENCRYPTED } from "@stegcloak/core";

const C = { ZWC, FLAG_ENCRYPTED };

async function cliHide(secret, password, cover, crypt, integrity, op) {
  const stegcloak = new StegCloak(crypt, integrity);
  const spinner = ora(chalk.cyan.bold("Hiding your text"));
  spinner.start();
  let payload;
  try {
    payload = await stegcloak.hide(secret, password, cover);
  } catch (e) {
    console.log("\n");
    console.log(chalk.red(e));
    process.exit(0);
  }
  await clipboardy.write(payload);
  setTimeout(() => {
    spinner.stop();
    if (op) {
      writeFileSync(op, payload);
      console.log(chalk.grey(`\n Written to ${op} \n`));
      process.exit(0);
    }
    console.log(chalk.grey("\nCopied to clipboard\n"));
    process.exit(0);
  }, 300);
}

function createStringQuestion(str, nameIt) {
  return { type: "input", message: str, name: nameIt };
}

async function cliReveal(payload, password, op) {
  const stegcloak = new StegCloak();
  const spinner = ora(chalk.cyan.bold("Decrypting"));
  spinner.start();
  let secret;
  try {
    secret = await stegcloak.reveal(payload, password);
  } catch (e) {
    console.log("\n");
    console.log(chalk.red(e));
    process.exit(0);
  }
  setTimeout(() => {
    spinner.stop();
    if (op) {
      writeFileSync(op, secret);
      console.log(chalk.grey(`\n Written to ${op} \n`));
    }
    console.log("\n");
    console.log(
      chalk.cyan.bold("         Secret: ") + chalk.green.bold(secret)
    );
    console.log("\n");
    process.exit(0);
  }, 300);
}

program
  .command("hide [secret] [cover]")
  .option("-fc, --fcover <fcover> ", "Extract cover text from file")
  .option("-fs, --fsecret <fsecret> ", "Extract secret text from file")
  .option("-n, --nocrypt", "If you don't need encryption", false)
  .option(
    "-i, --integrity",
    "If additional security of preventing tampering is needed",
    false
  )
  .option("-o, --output <output> ", "Stream the results to an output file")
  .option("-c, --config <config>", "Config file")
  .action(async (secret, cover, args) => {
    if (args.config) {
      readFileJson(args.config)
        .then(async (obj) => {
          if (!("secret" in obj && "cover" in obj)) {
            console.error(chalk.red("Config Parse error") + " : Missing inputs");
            process.exit(0);
          }
          secret = obj.secret;
          cover = obj.cover;
          let password = obj.password || process.env["STEGCLOAK_PASSWORD"];
          if (!obj.password && process.env["STEGCLOAK_PASSWORD"]) {
            console.warn(
              chalk.yellow("Warning:") +
                " using password from environment variable"
            );
          }
          let integrity = obj.integrity || false;
          let nocrypt = obj.nocrypt || false;
          let output = obj.output || false;
          await cliHide(secret, password, cover, !nocrypt, integrity, output);
        })
        .catch((error) => console.error(error));
      return;
    }

    const questions = process.env["STEGCLOAK_PASSWORD"]
      ? (console.warn(
          chalk.yellow("Warning:") + " using password from environment variable\n"
        ),
        [])
      : [
          {
            type: "password",
            message: "Enter password :",
            name: "password",
            mask: "*",
          },
        ];

    const qsecret = "What's your secret? :";
    const qcover =
      "Enter the text you want to hide your secret within? (Minimum 2 words):";

    if (args.nocrypt) questions.pop();

    if (args.fcover) {
      cover = readFileSync(args.fcover, "utf-8");
    }

    if (args.fsecret) {
      secret = readFileSync(args.fsecret, "utf-8");
    }

    if (!secret && !cover) {
      questions.push(
        createStringQuestion(qsecret, "secret"),
        createStringQuestion(qcover, "cover")
      );
    } else if (!secret) {
      questions.push(createStringQuestion(qsecret, "secret"));
    } else if (!cover) {
      questions.push(createStringQuestion(qcover, "cover"));
    }

    let answers = {};
    if (questions.length) {
      answers = await inquirer.prompt(questions);
    }
    await cliHide(
      answers.secret || secret,
      answers.password || process.env["STEGCLOAK_PASSWORD"],
      cover || answers.cover,
      !args.nocrypt,
      args.integrity,
      args.output
    );
  });

program
  .command("reveal [message]")
  .option("-f, --file <file> ", "Extract message to be revealed from file")
  .option("-cp, --clip", "Copy message directly from clipboard")
  .option("-o, --output <output> ", "Stream the secret to an output file")
  .option("-c, --config <config>", "Config file")
  .action(async (data, args) => {
    if (args.config) {
      readFileJson(args.config)
        .then(async (obj) => {
          if (!("message" in obj)) {
            console.error(chalk.red("Config Parse error") + " : Missing inputs");
            process.exit(0);
          }
          data = obj.message;
          if (!obj.password && process.env["STEGCLOAK_PASSWORD"]) {
            console.warn(
              chalk.yellow("Warning:") +
                " using password from environment variable"
            );
          }
          let password = obj.password || process.env["STEGCLOAK_PASSWORD"];
          let output = obj.output || false;
          await cliReveal(data, password, output);
        })
        .catch((error) => console.error(error));
      return;
    }

    const questions = [
      { type: "input", message: "Enter message to decrypt:", name: "payload" },
      {
        type: "password",
        message: "Enter password :",
        name: "password",
        mask: "*",
      },
    ];

    if (args.file) {
      data = readFileSync(args.file, "utf-8");
      console.log(
        chalk.cyan(`Extracted text from ${args.file} to be decrypted !`)
      );
      console.log();
    }

    if (args.clip || data) {
      const mutatedQuestions = questions.slice(1);

      data = data || (await clipboardy.read());

      let isEncrypted = true;
      try {
        const detached = detach(data, StegCloak.zwc);
        const decoded = decodeBase6(detached, StegCloak.zwc);
        if (decoded.length >= 2) {
          const flags = decoded[1];
          isEncrypted = (flags & C.FLAG_ENCRYPTED) !== 0;
        }
      } catch (e) {
        // default to expecting encryption
      }

      if (!isEncrypted || process.env["STEGCLOAK_PASSWORD"]) {
        if (process.env["STEGCLOAK_PASSWORD"]) {
          console.warn(
            chalk.yellow("Warning:") +
              " using password from environment variable"
          );
        }
        mutatedQuestions.pop();
      }

      if (mutatedQuestions.length) {
        const answers = await inquirer.prompt(mutatedQuestions);
        await cliReveal(
          data,
          answers.password || process.env["STEGCLOAK_PASSWORD"],
          args.output
        );
      } else {
        await cliReveal(
          data,
          process.env["STEGCLOAK_PASSWORD"] || null,
          args.output
        );
      }
    } else {
      const answers = await inquirer.prompt([questions[0]]);
      let isEncrypted = true;
      try {
        const detached = detach(answers.payload, StegCloak.zwc);
        const decoded = decodeBase6(detached, StegCloak.zwc);
        if (decoded.length >= 2) {
          const flags = decoded[1];
          isEncrypted = (flags & C.FLAG_ENCRYPTED) !== 0;
        }
      } catch (e) {
        // default to expecting encryption
      }

      if (!isEncrypted) {
        await cliReveal(answers.payload, null, args.output);
      } else {
        if (!process.env["STEGCLOAK_PASSWORD"]) {
          const ans = await inquirer.prompt([questions[1]]);
          await cliReveal(answers.payload, ans.password, args.output);
        } else {
          await cliReveal(
            answers.payload,
            process.env["STEGCLOAK_PASSWORD"],
            args.output
          );
        }
      }
    }
  });

program.parse(process.argv);

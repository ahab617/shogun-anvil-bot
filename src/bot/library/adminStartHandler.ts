import { bot } from "../index";
import config from "../../config.json";
import { generateCallbackOption } from "./index";
import { deleteMessage, deleteMessage1 } from "./index";
import { SendMessageOptions } from "node-telegram-bot-api";
import adminListController from "../../controller/adminList";
import { adminReturnHandler } from "../library/returnHandler";
import depositSettingController from "../../controller/adminSetting";

interface TadminStatus {
  depositEdit: boolean;
  gasFeeEdit: boolean;
  addAdmin: boolean;
}

interface TadminData {
  userId: number;
  userName: string;
}

interface TadminDetail {
  text: string;
  callback_data: string;
}

let adminStatus: TadminStatus = {
  depositEdit: false,
  gasFeeEdit: false,
  addAdmin: false,
};

let depositMiniAmount = 0 as number;
let gasFee = 0 as number;

export const adminStartHandler = async (msg: any) => {
  try {
    bot.sendMessage(
      msg.chat.id,
      `
Welcome to <b>Admin Shogun Anvil Bot!</b>

Click the button below to proceed with the setup.
    `,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Admin Setup  ✔️", callback_data: "setup_admin" }],
            [{ text: "Return  👈", callback_data: "main_return" }],
          ],
        },
      }
    );
  } catch (error) {
    console.log("adminStartHandlerError: ", error);
  }
};

bot.on("callback_query", async (callbackQuery) => {
  const msg = callbackQuery.message;
  if (msg) {
    const callbackData = callbackQuery.data;
    switch (callbackData) {
      case "deposit_setting":
        depositAmountModal(msg);
        adminStatus.depositEdit = true;
        break;

      case "main_return":
        adminStatus = {
          depositEdit: false,
          gasFeeEdit: false,
          addAdmin: false,
        };
        deleteMessage(msg);
        adminReturnHandler(msg);
        break;

      case "setup_admin":
        addAdmin(msg);
        break;

      case "add_admin":
        adminStatus.addAdmin = true;
        addAdminModal(msg);
        break;

      case "deposit_setup":
        depositSettingHandler(msg);
        break;

      // case "fee_setup":
      //   FeeEditModal(msg);
      //   break;

      case "admin_ui":
        deleteMessage(msg);
        adminStartHandler(msg);
        break;

      case "setting_save":
        resultShowModal(msg);
        break;

      case "prev_return":
        addAdmin(msg);
        break;

      default: {
        if (callbackData?.startsWith("select_")) {
          selectAdminModal(msg, callbackData);
        } else if (callbackData?.startsWith("adminDelete_")) {
          const userId = Number(callbackData.split("_")[1]);
          adminDeleteConfirm(msg, userId);
        }
        break;
      }
    }
  }
});

bot.on("message", async (msg: any) => {
  if (msg.text && msg.text.startsWith("/")) return;

  const chatId = msg.chat.id;

  if (msg.text) {
    if (isSuperAdmin(chatId)) {
      if (adminStatus.depositEdit) {
        if (!isNaN(msg.text)) {
          depositMiniAmount = Number(msg.text);
          adminStatus.depositEdit = false;
          settingShowModal(msg);
          // adminStatus.gasFeeEdit = true;
          // gasFeeEditModal(msg);
        } else {
          validatorModal(msg);
        }
      } else if (adminStatus.gasFeeEdit) {
        if (!isNaN(msg.text) && Number(msg.text) < 100) {
          gasFee = Number(msg.text);
          adminStatus.gasFeeEdit = false;
          settingShowModal(msg);
        } else {
          validatorModal(msg);
        }
      } else if (adminStatus.addAdmin) {
        const adminData = msg.text.split("_");
        if (adminData?.length == 2) {
          const addAdmin = {
            userId: Number(adminData[0]),
            userName: adminData[1],
          };
          const result = await adminListController.create(addAdmin);
          addAdminResultModal(result, msg);
        } else {
          adminValidatorModal(msg);
        }
      }
    }
  }
});

const addAdmin = async (msg: any) => {
  try {
    deleteMessage(msg);
    let opts = {};
    let newText = `` as string;
    const baseOption = generateCallbackOption(msg, "HTML");
    const adminData = (await adminListController.find()) as Array<TadminData>;
    if (adminData?.length > 0) {
      const replyMarks = adminData.map((item: any) => {
        return [
          {
            text: `${item.userName} (${item.userId})`,
            callback_data: `select_${item.userId}_${item.userName}`,
          },
        ];
      });
      newText = `Here are admin list.`;
      opts = {
        ...baseOption,
        reply_markup: {
          inline_keyboard: [
            ...replyMarks,
            [
              {
                text: "Return  👈",
                callback_data: "admin_ui",
              },
              {
                text: "Add Admin",
                callback_data: "add_admin",
              },
            ],
          ],
        },
      };
    } else {
      newText = `You are the only admin of this bot.`;
      opts = {
        ...baseOption,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Return  👈",
                callback_data: "admin_ui",
              },
              {
                text: "Add Admin",
                callback_data: "add_admin",
              },
            ],
          ],
        },
      };
    }

    bot.sendMessage(msg.chat.id, newText, opts as SendMessageOptions);
  } catch (error) {
    console.log("addAdmin: ", error);
  }
};

const addAdminModal = async (msg: any) => {
  try {
    deleteMessage(msg);
    const baseOption = generateCallbackOption(msg, "HTML");
    const opts = { ...baseOption };
    const newText =
      `Please enter admin ID with userName.\n\n` + `<b>ex: 000000_King</b>`;
    bot.sendMessage(msg.chat.id, newText, opts as SendMessageOptions);
  } catch (error) {
    console.log("addAdminModal: ", error);
  }
};
const selectAdminModal = async (msg: any, data: any) => {
  try {
    deleteMessage(msg);
    const userId = Number(data.split("_")[1]);
    const userName = data.split("_")[2];
    const newText =
      `<b>ID: </b> ${userId}\n\n` + `<b>UserName: </b> ${userName}`;
    bot.sendMessage(msg.chat.id, newText, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Return  👈", callback_data: "prev_return" },
            { text: "Delete  ✔️", callback_data: `adminDelete_${userId}` },
          ],
        ],
      },
    });
  } catch (error) {
    console.log("selectAdminModal: ", error);
  }
};
const depositSettingHandler = async (msg: any) => {
  try {
    deleteMessage(msg);
    const data = await depositSettingController.findOne({
      filter: {
        userId: msg.chat.id,
      },
    });
    let headerText = "" as string;
    if (data) {
      headerText =
        `Welcome to Admin Shogun Anvil Bot!\n\n` +
        `Deposit MiniAmount: ${data.miniAmount} SOL \n\n`;
    } else {
      headerText =
        `Welcome to Admin Shogun Anvil Bot!\n\n` +
        `Please Set up the Deposit MiniAmount.`;
    }

    bot.sendMessage(msg.chat.id, headerText, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Return  👈", callback_data: "admin_ui" },
            { text: "Setting  ✔️", callback_data: "deposit_setting" },
          ],
        ],
      },
    });
  } catch (error) {
    console.log("DepositSetting in admin management: ", error);
  }
};

const depositAmountModal = async (msg: any) => {
  try {
    deleteMessage(msg);
    const newText = `Please Enter the Deposit MiniAmount.\n\n` + `ex: 0.5 `;
    bot.sendMessage(msg.chat.id, newText, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "Return  👈", callback_data: "admin_ui" }]],
      },
    });
  } catch (error) {
    console.log("DepositAmountModal in adminSetting: ", error);
  }
};
// const FeeEditModal = async (msg: any) => {
//   try {
//     deleteMessage(msg);
//     deleteMessage1(msg, msg.message_id - 1);
//     const newText = `Please select period of time to use.`

//     bot.sendMessage(msg.chat.id, newText, {
//       parse_mode: "HTML",
//       reply_markup: {
//         inline_keyboard: [
//           [
//             { text: "⏱️  1 months", callback_data: "trade_3" },
//             { text: "⏳  3 months", callback_data: "trade_5" },
//           ],
//           [
//             { text: "🕒  6 months", callback_data: "trade_10" },
//             { text: "⏰  12 months", callback_data: "trade_15" },
//           ],
//           [{ text: "Return  👈", callback_data: "admin_ui" }]
//         ],
//       },
//     });
//   } catch (error) {
//     console.log("GasFeeEditModal in adminSetting: ", error);
//   }
// };

const adminValidatorModal = async (msg: any) => {
  try {
    deleteMessage1(msg, msg.message_id - 1);
    const baseOption = generateCallbackOption(msg, "HTML");
    const opts = { ...baseOption };
    const newText = `Please enter the valid type.`;
    bot.sendMessage(msg.chat.id, newText, opts as SendMessageOptions);
  } catch (error) {
    console.log("adminValidatorModal in adminStartHandler:", error);
  }
};

const validatorModal = async (msg: any) => {
  try {
    deleteMessage1(msg, msg.message_id - 1);
    bot.sendMessage(
      msg.chat.id,
      `
      Please Valid Amount.
      `,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Return  👈", callback_data: "deposit_setting" }],
          ],
        },
      }
    );
  } catch (error) {
    console.log("validatorModal in adminStartHandler: ", error);
  }
};

const settingShowModal = async (msg: any) => {
  try {
    deleteMessage(msg);
    deleteMessage1(msg, msg.message_id - 1);
    const newText =
      `<b>Deposit Setup is ready.</b>\n\n` +
      `<b>Deposit MiniAmout: </b>  ${depositMiniAmount} SOL\n`;
    bot.sendMessage(msg.chat.id, newText, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Return  👈", callback_data: "admin_ui" },
            { text: "Save  👈", callback_data: "setting_save" },
          ],
        ],
      },
    });
  } catch (error) {
    console.log("SettingShowModal in adminStartHandler: ", error);
  }
};

const resultShowModal = async (msg: any) => {
  try {
    deleteMessage(msg);
    const data = {
      userId: msg.chat.id,
      miniAmount: depositMiniAmount,
    };
    const result = await depositSettingController.create(data);
    bot.sendMessage(msg.chat.id, `${result.msg}`, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "Return  👈", callback_data: "main_return" }],
        ],
      },
    });
  } catch (error) {
    console.log("resultShowModal in adminStartHandler:", error);
  }
};

const addAdminResultModal = async (result: any, msg: any) => {
  try {
    deleteMessage1(msg, msg.message_id - 1);
    const baseOption = await generateCallbackOption(msg, "HTML");
    const opts = { ...baseOption };
    adminStatus.addAdmin = false;
    bot.sendMessage(msg.chat.id, `${result?.msg}`, opts as SendMessageOptions);
  } catch (error) {
    console.log("AddAdminResultModal in adminStartHandler:", error);
  }
};

const adminDeleteConfirm = async (msg: any, userId: number) => {
  try {
    deleteMessage(msg);
    const result = await adminListController.deleteOne({
      filter: { userId: userId },
    });
    const baseOption = generateCallbackOption(msg, "HTML");
    const opts = { ...baseOption };
    if (result) {
      bot.sendMessage(
        msg.chat.id,
        `Delete is completed`,
        opts as SendMessageOptions
      );
    }
  } catch (error) {
    console.log("AdminDeleteConfirm in AdminStartHandler: ", error);
  }
};
const isSuperAdmin = (userId: any) => {
  return userId == config.SUPER_ADMIN_ID;
};

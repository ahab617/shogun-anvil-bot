import { bot } from "..";
import config from "../../config.json";
import userListController from "../../controller/userList";
import adminListController from "../../controller/adminList";

let isUserIdInput = false;
let isFeeInput = false;
let userId: number = 0;
export const addpermission = async (msg: any) => {
  const adminList = await adminListController.find();
  if (
    msg.chat.id == config.SUPER_ADMIN_ID ||
    adminList?.filter((item: any) => item.userId == msg.chat.id).length > 0
  ) {
    isUserIdInput = true;
    bot.sendMessage(msg.chat.id, `Please enter the user ID.`);
  } else {
    bot.sendMessage(msg.chat.id, `No permission`, {});
  }
};

bot.on("message", async (msg: any) => {
  if (msg.text && msg.text.startsWith("/")) {
    if (msg.text.indexOf("skip") > -1) {
      const result = await userListController.updateOne({
        userId: userId,
        permission: true,
      });
      bot.sendMessage(msg.chat.id, result?.msg, {});
    }
    isUserIdInput = false;
    isFeeInput = false;
    return;
  }
  if (msg.text) {
    if (isUserIdInput) {
      if (isNaN(msg.text) || !Number.isInteger(Number(msg.text))) {
        bot.sendMessage(msg.chat.id, `Please enter the valid user ID.`);
      } else {
        const result = await userListController.findOne({
          userId: Number(msg.text),
        });
        if (result) {
          isUserIdInput = false;
          isFeeInput = true;
          userId = Number(msg.text);
          const newText =
            `Enter the fee. ex: 20\n\n` + `Use /skip to leave the Fee as is.`;
          bot.sendMessage(msg.chat.id, newText, { parse_mode: "HTML" });
        } else {
          bot.sendMessage(msg.chat.id, `User not found.`, {});
        }
      }
    } else if (isFeeInput) {
      if (
        isNaN(msg.text) ||
        !Number.isInteger(Number(msg.text)) ||
        Number(msg.text) > 50 ||
        Number(msg.text) < 0
      ) {
        bot.sendMessage(
          msg.chat.id,
          `Please enter the valid fee. Use /skip to leave the Fee as is.`
        );
      } else {
        const result = await userListController.updateOne({
          userId: userId,
          permission: true,
          fee: Number(msg.text),
        });
        bot.sendMessage(msg.chat.id, result?.msg, {});
        isFeeInput = false;
      }
    }
  }
});

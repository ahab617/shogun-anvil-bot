import { bot } from "..";
import config from "../../config.json";
import userListController from "../../controller/userList";
import adminListController from "../../controller/adminList";

let isUserIdInput = false;
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
  if (msg.text) {
    if (isUserIdInput) {
      if (isNaN(msg.text) || !Number.isInteger(Number(msg.text))) {
        bot.sendMessage(msg.chat.id, `Please enter the valid user ID.`);
      } else {
        const result = await userListController.findOne({
          filter: {
            userId: Number(msg.text),
          },
        });
        if (result) {
          isUserIdInput = false;
          const result = await userListController.updateOne({
            userId: Number(msg.text),
            permission: true,
          });
          bot.sendMessage(msg.chat.id, result?.msg, {});
        } else {
          bot.sendMessage(msg.chat.id, `User not found.`, {});
        }
      }
    }
  }
});

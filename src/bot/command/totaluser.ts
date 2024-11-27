import { bot } from "../index";
import config from "../../config.json";
import adminListController from "../../controller/adminList";
import { totaluserHandler } from "../library/totaluserHandler";

const { Commands } = require("../index.ts");

export default new Commands(
  new RegExp(/^\/totaluser/),
  "Total Users",
  "totaluser",
  true,
  async (msg: any) => {
    const adminList = await adminListController.find();
    if (
      msg.chat.id == config.SUPER_ADMIN_ID ||
      adminList?.filter((item: any) => item.userId == msg.chat.id).length > 0
    ) {
      totaluserHandler(msg);
    } else {
      bot.sendMessage(msg.chat.id, `No permission.`, {});
    }
  }
);

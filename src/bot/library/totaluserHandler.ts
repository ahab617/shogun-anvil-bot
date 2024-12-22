import { bot } from "..";
import userListController from "../../controller/userList";
import tokenController from "../../controller/tokenSetting";
export const totaluserHandler = async (msg: any) => {
  const userInfo = await userListController.find();
  const tokenInfo = await tokenController.find();

  let user: Array<null> = [];
  let newText = `Total User: ${userInfo.length}\n\n`;
  if (userInfo.length > 0) {
    if (tokenInfo.length > 0) {
      user = userInfo.map((userItem: any, idx: number) => {
        const token = tokenInfo.filter(
          (item: any, index: number) => item.userId === userItem.userId
        );
        if (
          tokenInfo.filter(
            (item: any, index: number) => item.userId === userItem.userId
          ).length > 0
        ) {
          const token = tokenInfo.filter(
            (item: any, index: number) => item.userId === userItem.userId
          );
          return {
            userId: userItem.userId,
            Native_symbol: token[0].symbol,
            Native_coin: token[0].publicKey,
            fee: userItem.fee,
          };
        } else {
          return {
            userId: userItem.userId,
            Native_symbol: null,
            Native_coin: null,
            fee: userItem.fee,
          };
        }
      });
    } else {
      bot.sendMessage(msg.chat.id, `Token don't exist.`);
    }
  } else {
    bot.sendMessage(msg.chat.id, `User don't exist.`);
  }
  if (user.length > 0) {
    user.map((item: any, idx: number) => {
      newText +=
        `UserID: ${item?.userId}\n` +
        `Native Symbol: ${item?.Native_symbol}\n` +
        `Native Address: <code>${item?.Native_coin}</code>\n` +
        `Fee Setting: ${item?.fee} %\n\n`;
    });
  }
  bot.sendMessage(msg.chat.id, newText, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: "Return", callback_data: "return" }]],
    },
  });
};

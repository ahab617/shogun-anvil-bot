import { walletHandler } from "../library/walletHandler";
import { returnHandler } from "../library/returnHandler";
import { tokenSettingHandler } from "../library/tokenSettingHandler";
import {
  withdrawSelectHandler,
  applyWithdrawHandler,
  allWithdrawHandler,
  someWithdrawHandler,
} from "../library/withdrawhandler";
import {
  swapSettingHandler,
  swapConfirmHandler,
  enterFeeHandler,
  swapDeleteHandler,
  swapStopHandler,
  swapActiveHandler,
  dirConfirm,
  tradeTimeSetting,
} from "../library/swapHandler";
import {
  deleteWallethandler,
  confirmHandler,
  deleteTokenHandler,
  confirmTokenHandler,
} from "../library/deleteHandler";

export const callBackHandler = async (msg: any, action: string | any) => {
  switch (action) {
    default: {
      if (action.startsWith("open_wallet")) {
        walletHandler(msg);
      } else if (action.startsWith("token_setting")) {
        tokenSettingHandler(msg);
      } else if (action.startsWith("return")) {
        returnHandler(msg);
      } else if (action.startsWith("delete_wallet")) {
        deleteWallethandler(msg);
      } else if (action.startsWith("agree_delete_wallet")) {
        confirmHandler(msg);
      } else if (action.startsWith("delete_token")) {
        deleteTokenHandler(msg);
      } else if (action.startsWith("agree_delete_token")) {
        confirmTokenHandler(msg);
      } else if (action.startsWith("applyToken")) {
        withdrawSelectHandler(msg, action);
      } else if (action.startsWith("selectCoin")) {
        swapSettingHandler(msg);
      } else if (action.startsWith("agree_swap_delete")) {
        swapConfirmHandler(msg);
      } else if (action.startsWith("withdraw_apply")) {
        applyWithdrawHandler(msg);
      } else if (action.startsWith("amountAll_")) {
        allWithdrawHandler(msg, action);
      } else if (action.startsWith("amountSome_")) {
        someWithdrawHandler(msg, action);
      } else if (action.startsWith("enterFee_")) {
        enterFeeHandler(msg, action);
      } else if (action.startsWith("swap_delete")) {
        swapDeleteHandler(msg);
      } else if (action.startsWith("swap_stop")) {
        swapStopHandler(msg);
      } else if (action.startsWith("swap_active")) {
        swapActiveHandler(msg);
      } else if (action.startsWith("direction_")) {
        dirConfirm(msg, action);
      } else if (action.startsWith("trade_")) {
        tradeTimeSetting(msg, action);
      }
      break;
    }
  }
};

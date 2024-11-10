const { Wallet } = require("../db/model");

const findOne = async (props: any) => {
  try {
    const { filter } = props;
    const result = await Wallet.findOne(filter);
    return result;
  } catch (error) {
    throw new Error("Failed to find walletInfo");
  }
};

const find = async () => {
  try {
    const result = await Wallet.find();
    return result;
  } catch (error) {
    throw new Error("Failed to find walletInfo");
  }
};

const create = async (
  userId: string,
  publicKey: string,
  privateKey: string | any
) => {
  try {
    const newWallet = new Wallet({
      userId,
      publicKey,
      privateKey,
    });

    const savedWallet = await newWallet.save();
    return savedWallet;
  } catch (error) {
    throw new Error("Failed to create walletInfo");
  }
};

const deleteOne = async (props: any) => {
  try {
    const { filter } = props;
    const result = await Wallet.deleteOne(filter);
    return result;
  } catch (error) {
    throw new Error("Failed to delete walletInfo");
  }
};

export default {
  findOne,
  create,
  deleteOne,
  find,
};

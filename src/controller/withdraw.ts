const { Withdraw } = require("../db/model");

const findOne = async (props: any) => {
  const { filter } = props;
  const result = await Withdraw.findOne(filter);
  return result;
};
const find = async (props: any) => {
  const { filter } = props;
  const result = await Withdraw.find(filter);
  return result;
};
const create = async (props: any) => {
  try {
    const newWithdraw = new Withdraw(props);
    const newWithdrawSave = await newWithdraw.save();
    return newWithdrawSave;
  } catch (error) {
    return null;
  }
};
const updateOne = async (props: any) => {
  const result = await Withdraw.findOneAndUpdate(
    { userId: props.userId },
    { $set: { flag: true } }
  );
  return result;
};
export default {
  findOne,
  create,
  find,
  updateOne,
};

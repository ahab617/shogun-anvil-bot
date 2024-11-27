const { Tokens } = require("../db/model");
const { Swap } = require("../db/model");

const findOne = async (props: any) => {
  try {
    const { filter } = props;
    const result = await Tokens.findOne(filter);
    return result;
  } catch (error) {
    throw new Error("Failed to find tokenSettingInfo");
  }
};

const find = async () => {
  try {
    const result = await Tokens.find();
    return result;
  } catch (error) {
    throw new Error("Failed to find tokenSettingInfo");
  }
};

const create = async (tokenInfo: any) => {
  try {
    const newToken = new Tokens(tokenInfo);
    const newTokenSave = await newToken.save();

    return newTokenSave;
  } catch (error) {
    throw new Error("Failed to create tokenSettingInfo");
  }
};

const deleteOne = async (props: any) => {
  const { filter } = props;
  try {
    const r = await Swap.deleteOne(filter);
    if (r) {
      const result = await Tokens.deleteOne(filter);
      if (result) {
        return { status: 200 };
      } else {
        return { status: 202 };
      }
    } else {
      return { status: 202 };
    }
  } catch (error) {
    throw new Error("Failed to delete tokenSettingInfo");
  }
};

export default {
  findOne,
  find,
  create,
  deleteOne,
};

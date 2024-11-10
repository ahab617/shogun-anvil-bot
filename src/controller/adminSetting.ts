const { AdminSetting } = require("../db/model");

const findOne = async (props: any) => {
  const { filter } = props;
  try {
    const result = await AdminSetting.findOne(filter);
    return result;
  } catch (error) {
    throw new Error("Failed to find adminDepositSettingInfo");
  }
};
const find = async () => {
  try {
    const result = await AdminSetting.find();
    return { status: 200, result: result };
  } catch (error) {
    throw new Error("Failed to find adminDepositSettingInfo");
  }
};
const create = async (data: any) => {
  try {
    const result = await AdminSetting.findOne({ userId: data.userId });
    if (result) {
      const r = await AdminSetting.updateOne(data);
      if (r) {
        return { status: 200, msg: " Update is complete." };
      } else {
        return { status: 201, msg: "Update is failed" };
      }
    } else {
      const newData = new AdminSetting(data);
      const r = await newData.save();
      if (r) {
        return { status: 200, msg: "Setup is complete." };
      } else {
        return { status: 201, msg: "Setup is failed" };
      }
    }
  } catch (error) {
    throw new Error("Failed to create adminDepositSettingInfo");
  }
};

export default {
  find,
  findOne,
  create,
};

const { AdminList } = require("../db/model");

const find = async () => {
  try {
    const result = await AdminList.find();
    return result;
  } catch (error) {
    throw new Error("Failed to find deposit");
  }
};

const create = async (data: any) => {
  try {
    const result = AdminList.find({
      $or: [{ userName: data.userName }, { userId: data.userId }],
    });
    if (result?.length > 0) {
      return { status: 201, msg: "User exist already." };
    } else {
      const newData = new AdminList(data);
      const r = await newData.save();
      if (r) {
        return { status: 200, msg: "Register is complete." };
      } else {
        return { status: 201, msg: "Register is failed. please try again." };
      }
    }
  } catch (error) {
    return { status: 500, msg: "Internal server error" };
  }
};
const deleteOne = async (props: any) => {
  try {
    const { filter } = props;
    const result = await AdminList.deleteOne(filter);
    return result;
  } catch (err) {
    console.error("Error admin delete: ", err);
    return null;
  }
};

export default {
  find,
  create,
  deleteOne,
};

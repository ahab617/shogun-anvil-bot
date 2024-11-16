const { UserList } = require("../db/model");

const create = async (data: any) => {
  try {
    const user = await UserList.findOne({ userId: data.userId });
    const userCount = (await UserList.find().countDocuments()) || 0;
    if (user) {
      return userCount;
    } else {
      const newUser = new UserList(data);
      await newUser.save();
      return userCount + 1;
    }
  } catch (error) {
    throw new Error("Failed to create userListInfo");
  }
};

const findOne = async (data: any) => {
  try {
    const result = await UserList.findOne({ userId: data.userId });
    return result;
  } catch (error) {
    throw new Error(`Failed to find userList`);
  }
};

const updateOne = async (data: any) => {
  try {
    const result = await UserList.findOne({ userId: data.userId });
    if (result) {
      const r = await UserList.updateOne({ userId: data.userId }, data);
      if (r) {
        return { msg: `Permission added successfully` };
      } else {
        return { msg: `Failed to add permission` };
      }
    } else {
      return { msg: `User not found` };
    }
  } catch (error) {
    throw new Error(`Failed to add permission`);
  }
};

export default {
  create,
  updateOne,
  findOne,
};

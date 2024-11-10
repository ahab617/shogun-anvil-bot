const { UserList } = require("../db/model");

const create = async (data: any) => {
  try {
    const user = await UserList.findOne({ userId: data.userId });
    const userCount = await UserList.find().countDocuments();
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

export default {
  create,
};

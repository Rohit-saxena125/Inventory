const mongoose = require("mongoose");
const connectDb = async () => {
  try {
    const connectionInstance = await mongoose.connect(process.env.MONGO_URI);
    console.log(
      `MongoDB Connected... on DB HOST ${connectionInstance.connection.host}"info"`
    );
  } catch (error) {
    console.log(error);
  }
};
module.exports = connectDb;

import mongoose from 'mongoose';

// MongoDB Connection: Sets up connection to the MongoDB metadata database.
export const connectDB = async () => {
  try {
    const connUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/oxidrop';
    
    // Connect to database
    const conn = await mongoose.connect(connUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1); // Exit process with failure if DB connection is vital
  }
};

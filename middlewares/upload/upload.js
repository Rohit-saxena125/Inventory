const multer = require("multer");
const multerS3 = require("multer-s3");
const { S3Client,PutObjectCommand} = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");

const s3Client = new S3Client({
  region: process.env.Region,
  credentials: {
    accessKeyId: process.env.Access_key,
    secretAccessKey: process.env.Secret_Access_Key,
  },
});

exports.misData = async (filePath)=>{
    const fileContent = fs.readFileSync(filePath);
    const fileType = path.extname(filePath).toLowerCase();
    const contentType = fileType === ".pdf" ? "application/pdf" : "text/csv";
    const params = {
      Bucket: process.env.Bucket,
      Key: `Reports/${path.basename(filePath)}`,
      Body: fileContent,
      ContentType: contentType,
    };
    const data = await s3Client.send(new PutObjectCommand(params));
    return `https://${params.Bucket}.s3.${process.env.Region}.amazonaws.com/${params.Key}`;
  }
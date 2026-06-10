import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
const s3 = new S3Client({
  endpoint: "https://s3.subirei.com.br",
  region: "us-east-1",
  credentials: { accessKeyId: "BHfYHHqIaBjZjAewKoCJ", secretAccessKey: "vLhG23YaHZ0QNCPjyVIeQwXhbqX5TELRJ0xJYqw1" },
  forcePathStyle: true,
});
const cmd = new GetObjectCommand({ Bucket: "imob", Key: "uploads/prop-1780305793540-1422-jaguar.jpg" });
const res = await s3.send(cmd);
const body = res.Body;
console.log("Body type:", typeof body, body.constructor.name);
console.log("Has pipe:", typeof body.pipe);
console.log("Is async iterable:", typeof body[Symbol.asyncIterator]);
const chunks = [];
for await (const c of body) chunks.push(c);
const buf = Buffer.concat(chunks);
console.log("Buffer size:", buf.length);

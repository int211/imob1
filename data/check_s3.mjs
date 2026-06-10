import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
const s3 = new S3Client({
  endpoint: "https://s3.subirei.com.br",
  region: "us-east-1",
  credentials: { accessKeyId: "BHfYHHqIaBjZjAewKoCJ", secretAccessKey: "vLhG23YaHZ0QNCPjyVIeQwXhbqX5TELRJ0xJYqw1" },
  forcePathStyle: true,
});
try {
  const cmd = new GetObjectCommand({ Bucket: "imob", Key: "uploads/prop-1780305793540-1422-jaguar.jpg" });
  const res = await s3.send(cmd);
  console.log("ContentType:", res.ContentType);
  console.log("ContentLength:", res.ContentLength);
  const chunks = [];
  for await (const c of res.Body) chunks.push(c);
  console.log("Body size:", Buffer.concat(chunks).length);
} catch(e) {
  console.error("S3 error:", e.message, e.stack);
}

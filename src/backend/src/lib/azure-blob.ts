import { createWriteStream, mkdirSync, existsSync, readFileSync, unlinkSync } from "fs";
import { join, basename } from "path";
import { Readable } from "stream";
import logger from "./logger.js";

const LOCAL_FALLBACK_DIR = "/tmp/uploads";
const isAzureConfigured = (): boolean =>
  !!process.env.AZURE_STORAGE_CONNECTION_STRING;

function ensureLocalDir(): void {
  if (!existsSync(LOCAL_FALLBACK_DIR)) {
    mkdirSync(LOCAL_FALLBACK_DIR, { recursive: true });
  }
}

async function getContainerClient(
  containerName: string
): Promise<import("@azure/storage-blob").ContainerClient | null> {
  if (!isAzureConfigured()) return null;

  try {
    const { BlobServiceClient } = await import("@azure/storage-blob");
    const serviceClient = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING!
    );
    const containerClient = serviceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists();
    return containerClient;
  } catch (err) {
    logger.error({ err }, "Failed to get Azure Blob container client");
    return null;
  }
}

export async function uploadFile(
  buffer: Buffer,
  fileName: string,
  containerName?: string
): Promise<string> {
  const container =
    containerName ??
    process.env.AZURE_STORAGE_CONTAINER ??
    "mavericks-uploads";
  const containerClient = await getContainerClient(container);

  if (containerClient) {
    try {
      const blobName = `${Date.now()}-${fileName}`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: { blobContentType: getBlobContentType(fileName) },
      });
      logger.info({ blobName, container }, "File uploaded to Azure Blob");
      return blockBlobClient.url;
    } catch (err) {
      logger.error({ err, fileName }, "Azure Blob upload failed, using local fallback");
    }
  }

  // Local fallback
  ensureLocalDir();
  const localFileName = `${Date.now()}-${fileName}`;
  const localPath = join(LOCAL_FALLBACK_DIR, localFileName);
  const { writeFileSync } = await import("fs");
  writeFileSync(localPath, buffer);
  logger.info({ localPath }, "File saved locally (Azure fallback)");
  return `file://${localPath}`;
}

export async function downloadFile(blobUrl: string): Promise<Buffer> {
  if (blobUrl.startsWith("file://")) {
    const localPath = blobUrl.replace("file://", "");
    return readFileSync(localPath);
  }

  if (!isAzureConfigured()) {
    throw new Error("Azure Blob Storage not configured and URL is not local");
  }

  try {
    const { BlobClient } = await import("@azure/storage-blob");
    const blobClient = new BlobClient(blobUrl);
    const response = await blobClient.download();
    if (!response.readableStreamBody) {
      throw new Error("No readable stream in response");
    }
    return await streamToBuffer(response.readableStreamBody as NodeJS.ReadableStream);
  } catch (err) {
    logger.error({ err, blobUrl }, "Azure Blob download failed");
    throw err;
  }
}

export async function generateSasUrl(
  blobUrl: string,
  expiryMinutes: number = 60
): Promise<string> {
  if (blobUrl.startsWith("file://")) {
    return blobUrl;
  }

  if (!isAzureConfigured()) {
    return blobUrl;
  }

  try {
    const {
      BlobClient,
      generateBlobSASQueryParameters,
      BlobSASPermissions,
      StorageSharedKeyCredential,
    } = await import("@azure/storage-blob");

    const blobClient = new BlobClient(blobUrl);
    const accountName = blobClient.accountName;
    const containerName = blobClient.containerName;
    const blobName = blobClient.name;

    // Parse connection string for key
    const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING!;
    const accountKeyMatch = connStr.match(/AccountKey=([^;]+)/);
    if (!accountKeyMatch) return blobUrl;

    const accountKey = accountKeyMatch[1];
    const sharedKeyCredential = new StorageSharedKeyCredential(
      accountName,
      accountKey
    );

    const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);
    const sasToken = generateBlobSASQueryParameters(
      {
        containerName,
        blobName,
        permissions: BlobSASPermissions.parse("r"),
        expiresOn,
      },
      sharedKeyCredential
    ).toString();

    return `${blobUrl}?${sasToken}`;
  } catch (err) {
    logger.error({ err, blobUrl }, "Failed to generate SAS URL");
    return blobUrl;
  }
}

export async function deleteFile(blobUrl: string): Promise<void> {
  if (blobUrl.startsWith("file://")) {
    const localPath = blobUrl.replace("file://", "");
    try {
      unlinkSync(localPath);
    } catch {
      // ignore
    }
    return;
  }

  if (!isAzureConfigured()) {
    logger.warn({ blobUrl }, "Azure not configured, cannot delete blob");
    return;
  }

  try {
    const { BlobClient } = await import("@azure/storage-blob");
    const blobClient = new BlobClient(blobUrl);
    await blobClient.deleteIfExists();
    logger.info({ blobUrl }, "Blob deleted");
  } catch (err) {
    logger.error({ err, blobUrl }, "Failed to delete blob");
  }
}

function getBlobContentType(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop();
  const types: Record<string, string> = {
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    pdf: "application/pdf",
    json: "application/json",
    csv: "text/csv",
    txt: "text/plain",
  };
  return types[ext ?? ""] ?? "application/octet-stream";
}

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

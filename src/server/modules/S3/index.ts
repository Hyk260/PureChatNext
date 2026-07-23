import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import mime from 'mime'
import { z } from 'zod'

import { fileEnv } from '@/envs/file'
import { YEAR } from '@pure/utils'

export const fileSchema = z.object({
  Key: z.string(),
  LastModified: z.date(),
  Size: z.number(),
})

export const listFileSchema = z.array(fileSchema)

export type FileType = z.infer<typeof fileSchema>

const DEFAULT_S3_REGION = 'us-east-1'
const PUBLIC_READ_ACL_HEADER = 'public-read'

export interface PreSignedUpload {
  headers?: Record<string, string>
  url: string
}

// https://docs.aws.amazon.com/zh_cn/AmazonS3/latest/userguide/viewing-bucket-key-settings.html
export class S3 {
  private readonly client: S3Client

  private readonly bucket: string

  private readonly setAcl: boolean

  constructor(
    accessKeyId: string | undefined,
    secretAccessKey: string | undefined,
    endpoint: string | undefined,
    options?: {
      bucket?: string
      forcePathStyle?: boolean
      region?: string
      setAcl?: boolean
    }
  ) {
    if (!accessKeyId || !secretAccessKey || !endpoint)
      throw new Error('S3 environment variables are not set completely, please check your env')
    if (!options?.bucket) throw new Error('S3 bucket is not set, please check your env')

    this.bucket = options?.bucket
    this.setAcl = options?.setAcl || false

    this.client = new S3Client({
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      endpoint,
      forcePathStyle: options?.forcePathStyle,
      region: options?.region || DEFAULT_S3_REGION,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    })
  }

  public async deleteFile(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })

    return this.client.send(command)
  }

  public async deleteFiles(keys: string[]) {
    const command = new DeleteObjectsCommand({
      Bucket: this.bucket,
      Delete: { Objects: keys.map((key) => ({ Key: key })) },
    })

    return this.client.send(command)
  }

  public async getFileContent(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })

    const response = await this.client.send(command)

    if (!response.Body) {
      throw new Error(`No body in response with ${key}`)
    }

    return response.Body.transformToString()
  }

  public async getFileByteArray(key: string): Promise<Uint8Array> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })

    const response = await this.client.send(command)

    if (!response.Body) {
      throw new Error(`No body in response with ${key}`)
    }

    return response.Body.transformToByteArray()
  }

  /**
   * Get file metadata from S3 using HeadObject
   * This is used to verify actual file size from S3 instead of trusting client-provided values
   */
  public async getFileMetadata(key: string): Promise<{ contentLength: number; contentType?: string }> {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })

    const response = await this.client.send(command)

    return {
      contentLength: response.ContentLength ?? 0,
      contentType: response.ContentType,
    }
  }

  public async createPreSignedUrl(key: string): Promise<string> {
    const upload = await this.createPreSignedUpload(key)
    return upload.url
  }

  public async createPreSignedUpload(key: string): Promise<PreSignedUpload> {
    const command = new PutObjectCommand({
      ACL: this.setAcl ? PUBLIC_READ_ACL_HEADER : undefined,
      Bucket: this.bucket,
      Key: key,
    })

    const url = await getSignedUrl(this.client, command, { expiresIn: 3600 })

    return {
      headers: this.setAcl ? { 'x-amz-acl': PUBLIC_READ_ACL_HEADER } : undefined,
      url,
    }
  }

  public async createPreSignedUrlForPreview(key: string, expiresIn?: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })

    return getSignedUrl(this.client, command, {
      expiresIn: expiresIn ?? fileEnv.S3_PREVIEW_URL_EXPIRE_IN,
    })
  }

  /**
   * Upload buffer with specified content type
   */
  public async uploadBuffer(path: string, buffer: Buffer, contentType?: string, cacheControl?: string) {
    const command = new PutObjectCommand({
      ACL: this.setAcl ? 'public-read' : undefined,
      Body: buffer,
      Bucket: this.bucket,
      CacheControl: cacheControl,
      ContentType: contentType,
      Key: path,
    })

    return this.client.send(command)
  }

  public async uploadContent(path: string, content: string) {
    const command = new PutObjectCommand({
      ACL: this.setAcl ? 'public-read' : undefined,
      Body: content,
      Bucket: this.bucket,
      Key: path,
    })

    return this.client.send(command)
  }

  /**
   * Upload media file (images only) with long-term cache
   */
  public async uploadMedia(key: string, buffer: Buffer) {
    const contentType = mime.getType(key) || 'application/octet-stream'
    const command = new PutObjectCommand({
      ACL: this.setAcl ? 'public-read' : undefined,
      Body: buffer,
      Bucket: this.bucket,
      CacheControl: `public, max-age=${YEAR}`,
      ContentType: contentType,
      Key: key,
    })

    await this.client.send(command)
  }

  /**
   * List files in the bucket with an optional prefix
   */
  public async listFiles(prefix?: string): Promise<FileType[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      ...(prefix ? { Prefix: prefix } : {}),
    })

    const response = await this.client.send(command)

    return (
      response.Contents?.map((obj) => ({
        Key: obj.Key ?? '',
        LastModified: obj.LastModified ?? new Date(0),
        Size: obj.Size ?? 0,
      })) ?? []
    )
  }

  /**
   * Copy an object from sourceKey to destinationKey
   */
  public async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${sourceKey}`,
      Key: destinationKey,
    })

    await this.client.send(command)
  }
}

export class FileS3 extends S3 {
  constructor() {
    super(fileEnv.S3_ACCESS_KEY_ID, fileEnv.S3_SECRET_ACCESS_KEY, fileEnv.S3_ENDPOINT, {
      bucket: fileEnv.S3_BUCKET,
      forcePathStyle: fileEnv.S3_ENABLE_PATH_STYLE,
      region: fileEnv.S3_REGION,
      setAcl: fileEnv.S3_SET_ACL,
    })
  }
}

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

const ATTEMPTS = 30
const RETRY_DELAY_MS = 2_000

const required = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required before starting the container`)
  return value
}

const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration))

const autoCreateBucket = /^(1|true)$/i.test(process.env.S3_AUTO_CREATE_BUCKET || '')

if (!autoCreateBucket) {
  console.log('[S3] automatic bucket creation is disabled')
  process.exit(0)
}

const endpoint = required('S3_ENDPOINT')
const bucket = required('S3_BUCKET')
const accessKeyId = required('S3_ACCESS_KEY_ID')
const secretAccessKey = required('S3_SECRET_ACCESS_KEY')

const client = new S3Client({
  credentials: { accessKeyId, secretAccessKey },
  endpoint,
  forcePathStyle: process.env.S3_ENABLE_PATH_STYLE !== '0',
  region: process.env.S3_REGION || 'us-east-1',
})

const isMissingBucket = (error) =>
  ['NoSuchBucket', 'NotFound', 'NoSuchKey'].includes(error?.name) || [404].includes(error?.$metadata?.httpStatusCode)

const isAlreadyOwned = (error) =>
  ['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes(error?.name) ||
  [409].includes(error?.$metadata?.httpStatusCode)

const isRetryable = (error) => {
  const status = error?.$metadata?.httpStatusCode
  return !status || status === 408 || status === 425 || status === 429 || status >= 500
}

const verifyObject = async (mode) => {
  const key = process.env.S3_VERIFY_OBJECT
  if (!key || !mode) return

  if (mode === 'write') {
    await client.send(new PutObjectCommand({ Body: 'purechat-docker-verify', Bucket: bucket, Key: key }))
    console.log(`[S3] wrote verification object ${key}`)
    return
  }

  if (mode === 'read') {
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    const body = await response.Body?.transformToString()
    if (body !== 'purechat-docker-verify') throw new Error(`[S3] verification object ${key} did not persist`)
    console.log(`[S3] verified persisted object ${key}`)
    return
  }

  if (mode === 'delete') {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    console.log(`[S3] deleted verification object ${key}`)
    return
  }

  throw new Error(`Unsupported S3_VERIFY_MODE: ${mode}`)
}

let lastError
for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }))
    console.log(`[S3] bucket ${bucket} is ready`)
    await verifyObject(process.env.S3_VERIFY_MODE)
    lastError = undefined
    break
  } catch (headError) {
    lastError = headError
    if (!isMissingBucket(headError) && !isRetryable(headError)) throw headError

    if (isMissingBucket(headError)) {
      try {
        await client.send(new CreateBucketCommand({ Bucket: bucket }))
        console.log(`[S3] created bucket ${bucket}; verifying it is addressable`)
      } catch (createError) {
        if (isAlreadyOwned(createError)) {
          console.log(`[S3] bucket ${bucket} already exists; verifying ownership`)
        } else if (!isRetryable(createError)) {
          throw createError
        } else {
          lastError = createError
        }
      }

      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }))
        console.log(`[S3] bucket ${bucket} is ready`)
        await verifyObject(process.env.S3_VERIFY_MODE)
        lastError = undefined
        break
      } catch (verifyError) {
        lastError = verifyError
        if (!isMissingBucket(verifyError) && !isRetryable(verifyError)) throw verifyError
      }
    }

    if (attempt < ATTEMPTS) {
      console.log(`[S3] waiting for bucket service (${attempt}/${ATTEMPTS})`)
      await sleep(RETRY_DELAY_MS)
    }
  }
}

if (lastError) throw lastError

/**
 * Compatibility shim — use CredentialsContext going forward.
 */
export {
  CredentialsProvider as ApiKeyProvider,
  CredentialsProvider,
  useCredentials,
  useApiKey,
} from './CredentialsContext'

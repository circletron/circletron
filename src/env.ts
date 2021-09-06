export const requireEnv = (varName: string): string => {
  const value = process.env[varName]
  if (!value) {
    throw new Error(`Environment variable ${varName} must be set`)
  }
  return value
}

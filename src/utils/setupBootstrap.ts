export const resolveSetupCompletionStatus = (
  localCompleted: boolean,
  remoteCompleted: boolean | null,
) => {
  if (remoteCompleted === true) return true;
  if (localCompleted) return true;
  return false;
};

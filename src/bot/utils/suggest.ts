import { CommandStorage } from '../base/storage';

export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1),
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function findSimilarCommands(
  invalidCommand: string,
  maxSuggestions: number = 2,
  threshold: number = 3,
): string[] {
  const allCommands = Array.from(CommandStorage.getAllCommands().keys());
  const allDynamicCommands = Array.from(
    CommandStorage.getAllCommandsDymamic().keys(),
  );

  const commands = [...allCommands, ...allDynamicCommands];

  const distances = commands
    .map((cmd) => ({
      command: cmd,
      distance: levenshteinDistance(
        invalidCommand.toLowerCase(),
        cmd.toLowerCase(),
      ),
    }))
    .filter((item) => item.distance <= threshold)
    .sort((a, b) => a.distance - b.distance);

  return distances.slice(0, maxSuggestions).map((item) => item.command);
}

export function generateSuggestionMessage(invalidCommand: string): string {
  const similarCommands = findSimilarCommands(invalidCommand);

  if (similarCommands.length === 0) {
    return `command '${invalidCommand}' is not a valid command. Type *help for a list of available commands.`;
  }

  let message = `Command '${invalidCommand}' is not a valid command. See '*help'.\n`;
  message += 'Did you mean:\n';

  similarCommands.forEach((cmd) => {
    message += `  *${cmd}\n`;
  });

  return message;
}

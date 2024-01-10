import { Sudoku, SudokuZKApp } from './sudoku.js';
import { cloneSudoku, generateSudoku, solveSudoku } from './sudoku-lib.js';
import { PrivateKey, PublicKey, Mina, AccountUpdate } from 'o1js';

describe('sudoku', () => {
  let zkApp: SudokuZKApp;
  let zkAppPrivateKey: PrivateKey;
  let zkAppAddress: PublicKey;
  let sudoku: number[][];
  let sender: PublicKey;
  let senderKey: PrivateKey;

  beforeEach(async () => {
    let Local = Mina.LocalBlockchain({ proofsEnabled: false });
    Mina.setActiveInstance(Local);
    sender = Local.testAccounts[0].publicKey;
    senderKey = Local.testAccounts[0].privateKey;
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new SudokuZKApp(zkAppAddress);
    sudoku = generateSudoku(0.5);
  });

  it('accepts a correct solution', async () => {
    await deploy(zkApp, zkAppPrivateKey, sudoku, sender, senderKey);

    let isSolved = zkApp.isSolved.get().toBoolean();
    expect(isSolved).toBe(false);

    let solution = solveSudoku(sudoku);
    if (solution === undefined) throw Error('cannot happen');
    let tx = await Mina.transaction(sender, () => {
      let zkApp = new SudokuZKApp(zkAppAddress);
      zkApp.submitSolution(Sudoku.from(sudoku), Sudoku.from(solution!));
    });
    await tx.prove();
    await tx.sign([senderKey]).send();

    isSolved = zkApp.isSolved.get().toBoolean();
    expect(isSolved).toBe(true);
  });

  it('rejects an incorrect solution', async () => {
    await deploy(zkApp, zkAppPrivateKey, sudoku, sender, senderKey);

    let solution = solveSudoku(sudoku);
    if (solution === undefined) throw Error('cannot happen');

    let noSolution = cloneSudoku(solution);
    noSolution[0][0] = (noSolution[0][0] % 9) + 1;

    await expect(async () => {
      let tx = await Mina.transaction(sender, () => {
        let zkApp = new SudokuZKApp(zkAppAddress);
        zkApp.submitSolution(Sudoku.from(sudoku), Sudoku.from(noSolution));
      });
      await tx.prove();
      await tx.sign([senderKey]).send();
    }).rejects.toThrow(/array contains the numbers 1...9/);

    let isSolved = zkApp.isSolved.get().toBoolean();
    expect(isSolved).toBe(false);
  });
});

async function deploy(
  zkApp: SudokuZKApp,
  zkAppPrivateKey: PrivateKey,
  sudoku: number[][],
  sender: PublicKey,
  senderKey: PrivateKey
) {
  let tx = await Mina.transaction(sender, () => {
    AccountUpdate.fundNewAccount(sender);
    zkApp.deploy();
    zkApp.update(Sudoku.from(sudoku));
  });
  await tx.prove();
  await tx.sign([zkAppPrivateKey, senderKey]).send();
}

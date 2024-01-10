import {
  Field,
  SmartContract,
  method,
  Bool,
  state,
  State,
  Poseidon,
  Struct,
  Provable,
} from 'o1js';

export { Sudoku, SudokuZKApp };

class Sudoku extends Struct({
  value: Provable.Array(Provable.Array(Field, 9), 9),
}) {
  static from(value: number[][]) {
    return new Sudoku({ value: value.map((row) => row.map(Field)) });
  }

  hash() {
    return Poseidon.hash(this.value.flat());
  }
}

class SudokuZKApp extends SmartContract {
  @state(Field) sudokuHash = State<Field>();
  @state(Bool) isSolved = State<Bool>();

  @method init() {
    super.init();
  }

  @method update(sudokuInstancce: Sudoku) {
    this.sudokuHash.set(sudokuInstancce.hash());
    this.isSolved.set(Bool(false));
  }

  @method submitSolution(sudokuInstance: Sudoku, solutionInstance: Sudoku) {
    let sudoku = sudokuInstance.value;
    let solution = solutionInstance.value;

    let range9 = Array.from({ length: 9 }, (_, i) => i);
    let oneTo9 = range9.map((i) => Field(i + 1));

    function assertHas1To9(array: Field[]) {
      oneTo9
        .map((k) => range9.map((i) => array[i].equals(k)).reduce(Bool.or))
        .reduce(Bool.and)
        .assertTrue('array contains the numbers 1...9');
    }

    for (let i = 0; i < 9; i++) {
      let row = solution[i];
      assertHas1To9(row);
    }

    for (let j = 0; j < 9; j++) {
      let column = solution.map((row) => row[j]);
      assertHas1To9(column);
    }

    for (let k = 0; k < 9; k++) {
      let [i0, j0] = divmod(k, 3);
      let square = range9.map((m) => {
        let [i1, j1] = divmod(m, 3);
        return solution[3 * i0 + i1][3 * j0 + j1];
      });
      assertHas1To9(square);
    }

    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        let cell = sudoku[i][j];
        let solutionCell = solution[i][j];

        Bool.or(cell.equals(0), cell.equals(solutionCell)).assertTrue(
          `solution cell (${i + 1},${j + 1}) matches the original sudoku`
        );
      }
    }

    let sudokuHash = this.sudokuHash.getAndRequireEquals();

    sudokuInstance
      .hash()
      .assertEquals(sudokuHash, 'sudoku matches the one committed on-chain');

    this.isSolved.set(Bool(true));
  }
}

function divmod(k: number, n: number) {
  let q = Math.floor(k / n);
  return [q, k - q * n];
}

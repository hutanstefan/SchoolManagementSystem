import { minimumGrades, overallAverage, subjectAverage } from './averages';

describe('Romanian school averages', () => {
  describe('subjectAverage', () => {
    it('rounds .50 up to the next whole grade', () => {
      expect(subjectAverage([9, 10])).toEqual({
        average: 9.5,
        roundedAverage: 10,
      });
    });

    it('rounds below .50 down', () => {
      // 9.4285... -> 9.42 -> 9
      expect(subjectAverage([9, 9, 10, 10, 9, 9, 10])).toEqual({
        average: 9.42,
        roundedAverage: 9,
      });
    });

    it('truncates to two decimals instead of rounding them', () => {
      // 26 / 3 = 8.666... -> 8.66 (not 8.67)
      expect(subjectAverage([8, 9, 9]).average).toBe(8.66);
    });

    it('rounds the whole grade from the two-decimal average', () => {
      // 38 / 4 = 9.5 exactly -> 10
      expect(subjectAverage([9, 9, 10, 10]).roundedAverage).toBe(10);
      // 47 / 5 = 9.4 -> 9
      expect(subjectAverage([9, 9, 9, 10, 10]).roundedAverage).toBe(9);
    });

    it('has no average without grades', () => {
      expect(subjectAverage([])).toEqual({
        average: null,
        roundedAverage: null,
      });
    });
  });

  describe('overallAverage', () => {
    it('is the mean of the rounded subject averages, truncated to two decimals', () => {
      // (10 + 9 + 8) / 3 = 9
      expect(overallAverage([10, 9, 8])).toBe(9);
      // (10 + 9 + 9) / 3 = 9.333... -> 9.33
      expect(overallAverage([10, 9, 9])).toBe(9.33);
      // (10 + 10 + 9) / 3 = 9.666... -> 9.66
      expect(overallAverage([10, 10, 9])).toBe(9.66);
    });

    it('does not exist while a subject has no average', () => {
      expect(overallAverage([10, null, 9])).toBeNull();
      expect(overallAverage([])).toBeNull();
    });
  });

  it('requires weekly hours + 1 grades per subject', () => {
    expect(minimumGrades(1)).toBe(2);
    expect(minimumGrades(4)).toBe(5);
  });
});

import type { LectureSection } from './lecture-pdfs';

/** Who a demo lecture is shared with. */
export type DemoAudience =
  | { classes: string[] }
  /** The first students (by registration number) of each class, plus student@. */
  | { picks: Record<string, number>; includeDemoStudent: boolean };

export interface DemoLecture {
  /** "this" year or "last" (closed) year. */
  year: 'this' | 'last';
  subject: string;
  /** The teacher of this subject in this class shares it. */
  teacherOfClass: string;
  title: string;
  description: string;
  fileName: string;
  /** Days after the start of the school year. */
  day: number;
  audience: DemoAudience;
  sections: LectureSection[];
}

export const DEMO_LECTURES: DemoLecture[] = [
  {
    year: 'this',
    subject: 'Mathematics',
    teacherOfClass: '9A',
    title: 'Quadratic equations: summary',
    description:
      'Everything we did in class on quadratic equations, with a worked example. Read it before Thursday’s test.',
    fileName: 'quadratic-equations-summary.pdf',
    day: 18,
    audience: { classes: ['9A'] },
    sections: [
      {
        heading: 'The standard form',
        paragraphs: [
          'A quadratic equation is an equation that can be written as ax^2 + bx + c = 0, where a, b and c are real numbers and a is not 0. The number a is the leading coefficient, b is the linear coefficient and c is the free term.',
          'Before solving, always bring the equation to the standard form: move every term to the left side and collect the terms of the same degree.',
        ],
      },
      {
        heading: 'The discriminant',
        paragraphs: [
          'The discriminant is D = b^2 - 4ac. Its sign tells how many real solutions the equation has, before computing them:',
        ],
        bullets: [
          'D > 0: two different real solutions, x1,2 = (-b +/- sqrt(D)) / (2a).',
          'D = 0: one double solution, x = -b / (2a).',
          'D < 0: no real solutions (the parabola does not touch the x axis).',
        ],
      },
      {
        heading: "Vieta's formulas",
        paragraphs: [
          'If x1 and x2 are the solutions of ax^2 + bx + c = 0, then their sum is S = x1 + x2 = -b/a and their product is P = x1 * x2 = c/a. They let you check a result quickly, or build an equation from its solutions: x^2 - Sx + P = 0.',
        ],
      },
      {
        heading: 'Worked example',
        steps: [
          'Solve 2x^2 - 7x + 3 = 0. Here a = 2, b = -7, c = 3.',
          'D = (-7)^2 - 4 * 2 * 3 = 49 - 24 = 25 > 0, so there are two solutions.',
          'x1 = (7 + 5) / 4 = 3 and x2 = (7 - 5) / 4 = 1/2.',
          'Check with Vieta: S = 3 + 1/2 = 7/2 = -b/a and P = 3 * 1/2 = 3/2 = c/a.',
        ],
      },
      {
        heading: 'Exercises',
        steps: [
          'Solve x^2 - 5x + 6 = 0 and x^2 + 4x + 4 = 0.',
          'For which values of m does x^2 - 2x + m = 0 have two different real solutions?',
          'Write a quadratic equation whose solutions are -2 and 5.',
          'Without solving it, find x1^2 + x2^2 for x^2 - 3x - 1 = 0.',
        ],
      },
    ],
  },
  {
    year: 'this',
    subject: 'Mathematics',
    teacherOfClass: '9A',
    title: 'Functions and their graphs',
    description:
      'The linear and the quadratic function: how to draw them and read them.',
    fileName: 'functions-and-graphs.pdf',
    day: 32,
    audience: { classes: ['9B', '10A'] },
    sections: [
      {
        heading: 'What a function is',
        paragraphs: [
          'A function f: A -> B gives every element x of the set A exactly one element f(x) of the set B. A is the domain, B is the codomain, and the set of all values f(x) is the image of f.',
          'The graph of f is the set of points (x, f(x)) in the plane. A vertical line meets the graph of a function at most once.',
        ],
      },
      {
        heading: 'The linear function',
        paragraphs: [
          'f(x) = ax + b. Its graph is a straight line: two points are enough to draw it, usually where it meets the axes, (0, b) and (-b/a, 0).',
        ],
        bullets: [
          'a > 0: the function is increasing.',
          'a < 0: the function is decreasing.',
          'a = 0: the function is constant and its graph is parallel to the x axis.',
        ],
      },
      {
        heading: 'The quadratic function',
        paragraphs: [
          'f(x) = ax^2 + bx + c, with a not 0. Its graph is a parabola with the vertex V(-b/(2a), -D/(4a)). The parabola opens upwards when a > 0 (the vertex is a minimum) and downwards when a < 0 (the vertex is a maximum).',
        ],
        steps: [
          'Find the vertex and the axis of symmetry x = -b/(2a).',
          'Find where the graph meets the axes: (0, c), and the solutions of f(x) = 0, if any.',
          'Make a table with two or three more values on each side of the vertex, then draw.',
        ],
      },
      {
        heading: 'Exercises',
        steps: [
          'Draw the graphs of f(x) = 2x - 4 and g(x) = -x + 1 and find where they meet.',
          'Find the vertex of f(x) = x^2 - 6x + 5 and draw the parabola.',
          'Find the maximum of f(x) = -x^2 + 4x + 1.',
        ],
      },
    ],
  },
  {
    year: 'this',
    subject: 'Mathematics',
    teacherOfClass: '9A',
    title: 'Olympiad training: problem set 1',
    description:
      'For the students preparing for the Mathematics Olympiad, from every class. We discuss the solutions on Friday after classes.',
    fileName: 'olympiad-problem-set-1.pdf',
    day: 40,
    audience: {
      picks: { '9A': 2, '9B': 1, '10A': 2, '11A': 1 },
      includeDemoStudent: true,
    },
    sections: [
      {
        heading: 'How to work on these',
        paragraphs: [
          'Try every problem on your own for at least half an hour before looking for hints. Write complete solutions: at the Olympiad, the reasoning counts as much as the answer.',
        ],
      },
      {
        heading: 'Problems',
        steps: [
          'Show that for every natural number n, the number n^3 - n is divisible by 6.',
          'Find all real numbers x for which |x - 1| + |x + 2| = 5.',
          'The sum of three consecutive odd numbers is 99. Find the numbers.',
          'Show that if a + b = 1, with a and b positive real numbers, then ab <= 1/4.',
          'In a triangle ABC, the bisector of angle A meets BC at D. Show that BD / DC = AB / AC.',
          'How many numbers of four different digits can be written with the digits 0, 1, 2, 3 and 4?',
        ],
      },
      {
        heading: 'Hints (read only if you are stuck)',
        bullets: [
          'Problem 1: n^3 - n = (n - 1) n (n + 1), three consecutive numbers.',
          'Problem 2: split the real line at -2 and at 1.',
          'Problem 4: use (a - b)^2 >= 0.',
        ],
      },
    ],
  },
  {
    year: 'this',
    subject: 'Romanian Language',
    teacherOfClass: '9A',
    title: 'Ion Creangă, Amintiri din copilărie: reading guide',
    description:
      'Questions to keep in mind while reading the first part. Bring your notes to class.',
    fileName: 'amintiri-din-copilarie-reading-guide.pdf',
    day: 25,
    audience: { classes: ['9A'] },
    sections: [
      {
        heading: 'About the book',
        paragraphs: [
          'Amintiri din copilarie (Memories of My Boyhood) is the best-known work of Ion Creanga. Written as the memories of an adult looking back at his childhood in Humulesti, it mixes humour, nostalgia and the speech of the Moldavian village.',
        ],
      },
      {
        heading: 'While you read the first part',
        bullets: [
          'Note every episode in which Nica breaks a rule. How is he punished, and how does the narrator judge him now?',
          'Find three expressions from the spoken language of the village and explain them.',
          'How are the mother and the father described? Quote one line for each.',
          'Where does the adult narrator interrupt the story to comment on it?',
        ],
      },
      {
        heading: 'For the next class',
        paragraphs: [
          'Choose one episode and retell it in about 150 words, keeping the order of the events. Then write two sentences about what makes it funny.',
        ],
      },
    ],
  },
  {
    year: 'last',
    subject: 'Mathematics',
    teacherOfClass: '9A',
    title: 'Linear equations and inequalities: review',
    description: 'Review sheet for the end of semester 1.',
    fileName: 'linear-equations-review.pdf',
    day: 110,
    audience: { classes: ['9A'] },
    sections: [
      {
        heading: 'Linear equations',
        paragraphs: [
          'ax + b = 0 has exactly one solution, x = -b/a, when a is not 0. When a = 0, it has no solution (b not 0) or every real number is a solution (b = 0).',
        ],
      },
      {
        heading: 'Linear inequalities',
        paragraphs: [
          'Solve them like equations, with one rule to remember: multiplying or dividing both sides by a negative number reverses the inequality sign. Write the answer as an interval.',
        ],
      },
      {
        heading: 'Exercises',
        steps: [
          'Solve 3(x - 2) = 2x + 5.',
          'Solve -2x + 7 > 1 and write the solution as an interval.',
          'For which values of m does mx - 3 = 2x have no solution?',
        ],
      },
    ],
  },
];

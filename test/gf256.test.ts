import { describe, expect, test } from "bun:test";
import { Generators, GF256, type Point, Polynomials } from "../src";

describe("GF256", () => {
    const field = new GF256(
        Polynomials.AES,
        Generators.AES,
    );

    test("constructor validation", () => {
        // Valid construction
        expect(() => new GF256()).not.toThrow();
        expect(() => new GF256(Polynomials.AES, Generators.AES)).not.toThrow();
        expect(() => new GF256(Polynomials.REED_SOLOMON, Generators.REED_SOLOMON)).not.toThrow();
        expect(() => new GF256(Polynomials.REED_SOLOMON, Generators.FAST)).not.toThrow();

        // Invalid parameters
        expect(() => new GF256(-1)).toThrow();
        expect(() => new GF256(65536)).toThrow();
        expect(() => new GF256(Polynomials.AES, Polynomials.AES)).toThrow();
        expect(() => new GF256(Polynomials.AES, -1)).toThrow();
        expect(() => new GF256(Polynomials.REED_SOLOMON, Generators.AES)).toThrow();
        expect(() => new GF256(Polynomials.REED_SOLOMON, 256)).toThrow();
    });

    test("basic arithmetic operations", () => {
        // Addition
        expect(field.add(0x53, 0xCA)).toBe(0x99); // 0x53 ⊕ 0xCA = 0x99
        expect(field.add(0, 5)).toBe(5);
        expect(field.add(5, 0)).toBe(5);

        // Subtraction (same as addition in GF(2^8))
        expect(field.sub(0x53, 0xCA)).toBe(0x99);
        expect(field.sub(5, 5)).toBe(0);

        // Multiplication
        expect(field.mul(0, 5)).toBe(0);
        expect(field.mul(5, 0)).toBe(0);
        expect(field.mul(1, 5)).toBe(5);

        // Division
        expect(field.div(0, 5)).toBe(0);
        expect(field.div(5, 1)).toBe(5);
        expect(() => field.div(5, 0)).toThrow();
    });

    test("multiplicative inverse", () => {
        // Test inverse operation
        const a = 0x53;
        const aInv = field.inv(a);
        expect(field.mul(a, aInv)).toBe(1);

        // Test inverse of 0
        expect(() => field.inv(0)).toThrow();

        // Test inverse of 1
        expect(field.inv(1)).toBe(1);
    });

    test("polynomial evaluation", () => {
        const coefficients = new Uint8Array([1, 2, 3]); // x² + 2x + 1

        // Test evaluation at various points
        expect(() => field.evaluate(coefficients, 0)).toThrow();
        expect(field.evaluate(coefficients, 1)).toBe(0);
        expect(field.evaluate(coefficients, 2)).toBe(9);

        // Test with a single coefficient
        const constant = new Uint8Array([5]);
        expect(field.evaluate(constant, 2)).toBe(5);
    });

    test("interpolation", () => {
        const points: Point[] = [
            { x: 1, y: 1 },
            { x: 2, y: 2 },
            { x: 3, y: 3 },
        ];


        // Test basic interpolation
        expect(() => field.interpolate([], 1)).toThrow();
        expect(field.interpolate(points, 4)).toBeDefined();

        // Test with a single point
        expect(field.interpolate([{ x: 1, y: 5 }], 2)).toBe(5);
    });

    test("generator validation", () => {
        // Test generator finding
        const generators = GF256.findAllGenerators(Polynomials.AES);
        expect(generators).toBeInstanceOf(Array);
        expect(generators.length).toBeGreaterThan(0);

        // Verify known generator
        expect(GF256.isGenerator(Polynomials.AES, Generators.AES)).toBe(true);
        expect(GF256.isGenerator(Polynomials.AES, 0)).toBe(false);
        expect(GF256.isGenerator(Polynomials.AES, 1)).toBe(false);
    });

    test("polynomial generation", () => {
        const degree = 3;
        const intercept = 42;

        const poly = GF256.makePolynomial(intercept, degree);

        expect(poly).toBeInstanceOf(Uint8Array);
        expect(poly.length).toBe(degree + 1);
        expect(poly[0]).toBe(intercept);
    });

    test("input validation", () => {
        // Test invalid inputs for arithmetic operations
        expect(() => field.add(-1, 0)).toThrow();
        expect(() => field.add(256, 0)).toThrow();
        expect(() => field.mul(-1, 0)).toThrow();
        expect(() => field.div(0, 256)).toThrow();

        // Test invalid inputs for other operations
        expect(() => field.evaluate(new Uint8Array([1]), 256)).toThrow();
    });

    describe("Galois Field Arithmetic Properties", () => {
        test("modular multiplication", () => {
            expect(field.mul(100, 100)).toBe(215);
            expect(field.mul(110, 110)).toBe(147);
            expect(field.mul(241, 118)).toBe(130);
            expect(field.mul(255, 255)).toBe(19);
            expect(field.mul(128, 128)).toBe(154);
            expect(field.mul(90, 21)).toBe(254);
        });

        test("multiplicative identity", () => {
            for (let i = 1; i < 256; i++) {
                expect(field.mul(i, 1)).toBe(i);    // 1 is multiplicative identity
                expect(field.mul(1, i)).toBe(i);
            }
        });

        test("multiplicative inverse properties", () => {
            // Test that a * a^(-1) = 1 for all non-zero elements
            for (let i = 1; i < 256; i++) {
                const inv = field.inv(i);
                expect(field.mul(i, inv)).toBe(1);
            }
        });

        test("additive properties", () => {
            // Adding zero
            for (let i = 0; i < 256; i++) {
                expect(field.add(i, 0)).toBe(i);    // Identity
                expect(field.add(0, i)).toBe(i);
            }

            // Self-inverse under addition (a + a = 0)
            for (let i = 0; i < 256; i++) {
                expect(field.add(i, i)).toBe(0);
            }
        });

        test("distributive property", () => {
            // Test (a + b) * c = (a * c) + (b * c)
            const testCases = [
                { a: 45, b: 67, c: 89 },
                { a: 123, b: 234, c: 78 },
                { a: 255, b: 128, c: 190 },
            ];

            for (const { a, b, c } of testCases) {
                const left = field.mul(field.add(a, b), c);
                const right = field.add(field.mul(a, c), field.mul(b, c));
                expect(left).toBe(right);
            }
        });

        test("associative properties", () => {
            const testCases = [
                { a: 23, b: 45, c: 67 },
                { a: 89, b: 144, c: 233 },
                { a: 255, b: 128, c: 64 },
            ];

            // Multiplication associativity: (a * b) * c = a * (b * c)
            for (const { a, b, c } of testCases) {
                const left = field.mul(field.mul(a, b), c);
                const right = field.mul(a, field.mul(b, c));
                expect(left).toBe(right);
            }

            // Addition associativity: (a + b) + c = a + (b + c)
            for (const { a, b, c } of testCases) {
                const left = field.add(field.add(a, b), c);
                const right = field.add(a, field.add(b, c));
                expect(left).toBe(right);
            }
        });

        test("division properties", () => {
            // Test that (a * b) / b = a for all non-zero b
            for (let a = 0; a < 256; a++) {
                for (let b = 1; b < 256; b++) {
                    const product = field.mul(a, b);
                    expect(field.div(product, b)).toBe(a);
                }
            }
        });

        test("polynomial arithmetic", () => {
            // Test polynomial evaluation at different points
            const coefficients = new Uint8Array([1, 2, 3]); // x² + 2x + 1
            const testPoints = [1, 2, 4, 8, 16, 32, 64, 128];

            for (const x of testPoints) {
                const result = field.evaluate(coefficients, x);
                // Test that result = 3x² + 2x + 1 in GF(256)
                const expected = field.add(
                    field.add(
                        field.mul(3, field.mul(x, x)),
                        field.mul(2, x),
                    ),
                    1,
                );
                expect(result).toBe(expected);
            }
        });

        test("field characteristics", () => {
            // Test that adding a number to itself 255 times equals the number
            // (characteristic of the field is 2, so any element added to itself is 0)
            const testValue = 123;
            let result = 0;
            for (let i = 0; i < 255; i++) {
                result = field.add(result, testValue);
            }
            expect(result).toBe(testValue);
        });
    });
});

describe("Polynomial Operations", () => {
    const field = new GF256(
        Polynomials.AES,
        Generators.AES,
    );

    test("makePolynomial validation", () => {
        // Valid cases
        expect(() => GF256.makePolynomial(0, 0)).not.toThrow();
        expect(() => GF256.makePolynomial(123, 5)).not.toThrow();
        expect(() => GF256.makePolynomial(255, 10)).not.toThrow();

        // Test the returned polynomial format
        const poly1 = GF256.makePolynomial(42, 0);
        expect(poly1.length).toBe(1);
        expect(poly1[0]).toBe(42);

        const poly2 = GF256.makePolynomial(123, 3);
        expect(poly2.length).toBe(4);
        expect(poly2[0]).toBe(123);

        // All coefficients are in valid GF(2^8) range (0-255)
        for (let i = 0; i < poly2.length; i++) {
            expect(poly2[i]).toBeGreaterThanOrEqual(0);
            expect(poly2[i]).toBeLessThanOrEqual(255);
        }
    });

    test("polynomial evaluation correctness", () => {
        // Test with known polynomial and evaluation points
        const poly = new Uint8Array([5, 10, 15]); // 15x² + 10x + 5

        // In GF(2^8), we need to use field operations for the calculation
        // For x=1: (15*1²) ⊕ (10*1) ⊕ 5
        const x1Expected = field.add(
            field.add(
                field.mul(15, field.mul(1, 1)), // 15 * 1²
                field.mul(10, 1),                // 10 * 1
            ),
            5,                                    // + 5
        );
        expect(field.evaluate(poly, 1)).toBe(x1Expected);

        // Evaluate at x=2: 15*2² + 10*2 + 5 = 15*4 + 20 + 5 = 85 (in GF(2^8))
        const x2Expected = field.add(
            field.add(
                field.mul(15, field.mul(2, 2)), // 15 * 2²
                field.mul(10, 2),                // 10 * 2
            ),
            5,                                    // + 5
        );
        expect(field.evaluate(poly, 2)).toBe(x2Expected);

        // Test with degree 0 polynomial (constant)
        const constant = new Uint8Array([42]);
        expect(field.evaluate(constant, 1)).toBe(42);
        expect(field.evaluate(constant, 2)).toBe(42);
        expect(field.evaluate(constant, 255)).toBe(42);

        // Test consistency with Horner's method calculation
        const complexPoly = new Uint8Array([7, 12, 23, 45, 67]); // 67x⁴ + 45x³ + 23x² + 12x + 7
        for (const x of [1, 2, 3, 4, 5, 10, 20, 50, 100, 200]) {
            // Manual calculation using Horner's method
            let result = complexPoly[complexPoly.length - 1]!;
            for (let i = complexPoly.length - 2; i >= 0; i--) {
                result = field.add(field.mul(result, x), complexPoly[i]!);
            }

            // Should match evaluate function
            expect(field.evaluate(complexPoly, x)).toBe(result);
        }
    });

    test("polynomial interpolation correctness", () => {
        // In GF(256), we can't use normal arithmetic to predict values
        // We need to use the field operations to compute expected values

        // Let's set up points that we know work in the field
        const points: Point[] = [
            { x: 1, y: 5 },
            { x: 2, y: 7 },
            { x: 3, y: 9 },
        ];

        // Interpolation should recover the original function values exactly
        expect(field.interpolate(points, 1)).toBe(5);
        expect(field.interpolate(points, 2)).toBe(7);
        expect(field.interpolate(points, 3)).toBe(9);

        // For x=4, we need to compute the expected value using Lagrange interpolation
        // We can test the consistency of the implementation instead of assuming a value
        const result = field.interpolate(points, 4);

        // We can manually compute the Lagrange basis polynomials at x=4:
        const l1 = field.mul(
            field.div(field.sub(4, 2), field.sub(1, 2)),
            field.div(field.sub(4, 3), field.sub(1, 3)),
        ); // L₁(4)

        const l2 = field.mul(
            field.div(field.sub(4, 1), field.sub(2, 1)),
            field.div(field.sub(4, 3), field.sub(2, 3)),
        ); // L₂(4)

        const l3 = field.mul(
            field.div(field.sub(4, 1), field.sub(3, 1)),
            field.div(field.sub(4, 2), field.sub(3, 2)),
        ); // L₃(4)

        // Then compute f(4) = y₁L₁(4) + y₂L₂(4) + y₃L₃(4)
        const expected = field.add(
            field.add(
                field.mul(5, l1),
                field.mul(7, l2),
            ),
            field.mul(9, l3),
        );

        expect(result).toBe(expected);

        // Test with a simpler case: constant polynomial
        const constantPoints: Point[] = [
            { x: 1, y: 42 },
            { x: 2, y: 42 },
            { x: 3, y: 42 },
        ];

        // A constant polynomial should give the same value everywhere
        expect(field.interpolate(constantPoints, 4)).toBe(42);
        expect(field.interpolate(constantPoints, 5)).toBe(42);
        expect(field.interpolate(constantPoints, 100)).toBe(42);

        // Test with linear points that follow GF(256) arithmetic
        // We'll use f(x) = 3x (in GF(256)) as our linear function
        const linearPoints: Point[] = [
            { x: 1, y: field.mul(3, 1) },  // f(1) = 3
            { x: 2, y: field.mul(3, 2) },  // f(2) = 6
            { x: 3, y: field.mul(3, 3) },   // f(3) = 9
        ];

        // Interpolation should recover the original points
        expect(field.interpolate(linearPoints, 1)).toBe(linearPoints[0]!.y);
        expect(field.interpolate(linearPoints, 2)).toBe(linearPoints[1]!.y);
        expect(field.interpolate(linearPoints, 3)).toBe(linearPoints[2]!.y);

        // At x=4, we should get f(4) = 3*4 = 12 in GF(256)
        expect(field.interpolate(linearPoints, 4)).toBe(field.mul(3, 4));
    });

    test("polynomial evaluation and interpolation consistency", () => {
        // Generate random polynomial 
        const degree = 4;
        const intercept = 42;
        const poly = GF256.makePolynomial(intercept, degree);

        // Create points by evaluating the polynomial
        const points: Point[] = [];
        for (let x = 1; x <= degree + 1; x++) {
            points.push({
                x,
                y: field.evaluate(poly, x),
            });
        }

        // Interpolation at original x values should give the same y values
        for (let i = 0; i < points.length; i++) {
            const point = points[i]!;
            expect(field.interpolate(points, point.x)).toBe(point.y);
        }

        // Test interpolation at new points
        for (let x = degree + 2; x < degree + 5; x++) {
            const directEval = field.evaluate(poly, x);
            const interpolated = field.interpolate(points, x);
            expect(interpolated).toBe(directEval);
        }
    });

    test("edge cases and error handling", () => {
        // Polynomial degree < number of points
        const points: Point[] = [
            { x: 1, y: 5 },
            { x: 2, y: 10 },
            { x: 3, y: 15 },
            { x: 4, y: 20 },
        ];

        // This should still work (will find the minimum degree polynomial)
        expect(() => field.interpolate(points, 5)).not.toThrow();

        // Test evaluation with an empty coefficient array
        expect(() => field.evaluate(new Uint8Array([]), 1)).toThrow();

        // Invalid x value for evaluation
        expect(() => field.evaluate(new Uint8Array([1, 2, 3]), 0)).toThrow();
        expect(() => field.evaluate(new Uint8Array([1, 2, 3]), 256)).toThrow();

        // Invalid arguments for makePolynomial
        expect(() => GF256.makePolynomial(-1, 3)).toThrow();
        expect(() => GF256.makePolynomial(256, 3)).toThrow();
        expect(() => GF256.makePolynomial(42, -1)).toThrow();
    });

    test("Lagrange basis polynomials", () => {
        // Test that Lagrange basis polynomials have the expected property:
        // L_i(x_j) = 1 if i=j, 0 otherwise

        const xs = [1, 2, 3, 4];

        // For each point index i
        for (let i = 0; i < xs.length; i++) {
            // Create a point set with y=1 at position i, y=0 elsewhere
            const points: Point[] = xs.map((x, idx) => ({
                x,
                y: idx === i ? 1 : 0,
            }));

            // Interpolation at xs[i] should be 1
            expect(field.interpolate(points, xs[i]!)).toBe(1);

            // Interpolation at other points should be 0
            for (let j = 0; j < xs.length; j++) {
                if (j !== i) {
                    expect(field.interpolate(points, xs[j]!)).toBe(0);
                }
            }
        }
    });
});
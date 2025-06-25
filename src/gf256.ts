import { randomBytes } from "crypto";
import { type Point } from "./shared";

/**
 * Common irreducible polynomials used in GF(2^8) fields.
 */
export enum Polynomials {
    // AES is the polynomial for AES (Rijndael): x^8 + x^4 + x^3 + x + 1
    AES = 0x11b,
    // REED_SOLOMON is the polynomial for Reed-Solomon (QR codes, CDs, DVDs): x^8 + x^4 + x^3 + x^2 + 1
    REED_SOLOMON = 0x11d,
}

/**
 * Common generator values used with GF(2^8) fields.
 */
export enum Generators {
    // AES is the standard generator for AES encryption.
    AES = 0x03,
    // REED_SOLOMON is a common generator for Reed-Solomon (QR codes, CDs, DVDs).
    REED_SOLOMON = 0xe5,
    // FAST is an alternate generator sometimes used in Reed-Solomon and erasure codes.
    FAST = 0x02,
}

/**
 * GF256 defines a Galois Field GF(2^8) with a given irreducible polynomial and generator.
 */
export class GF256 {
    // exp is the exponentiation table (duplicated for modulo-free lookups).
    private readonly exp: Uint8Array;
    // log is the logarithm table.
    private readonly log: Uint8Array;
    // poly is the irreducible polynomial, e.g., 0x11B.
    readonly poly: number;
    // gen is the generator, e.g., 0x03 or 0xE5.
    readonly gen: number;

    /**
     * Creates a new GF(2^8) field using the given polynomial and generator.
     * @param poly - The irreducible polynomial to define the field (default: Polynomials.AES).
     * @param gen - The generator for the field (default: Generators.AES).
     */
    constructor(poly: number = Polynomials.AES, gen: number = Generators.AES) {
        GF256.validateUInt16(poly, "poly");
        GF256.validateByte(gen, "gen");

        if (!GF256.isGenerator(poly, gen)) {
            throw new Error(`Invalid generator ${gen.toString(16)} for polynomial ${poly.toString(16)}`);
        }

        this.exp = new Uint8Array(512);
        this.log = new Uint8Array(256);
        this.poly = poly;
        this.gen = gen;

        let x = 1;
        for (let i = 0; i < 255; i++) {
            this.exp[i] = x;
            this.log[x] = i;

            // Multiply by generator in the field
            x = GF256.mulByte(x, gen, poly);
        }

        // Duplicate for safe wraparound without modulus
        for (let i = 0; i <= 255; i++) {
            this.exp[i + 255] = this.exp[i]!;
        }
    }

    /**
     * Performs multiplication in the Galois Field.
     * @param a - First operand (byte).
     * @param b - Second operand (byte).
     * @returns The result of a * b in GF(2^8).
     */
    mul(a: number, b: number): number {
        GF256.validateByte(a, "a");
        GF256.validateByte(b, "b");

        if (a === 0 || b === 0) {
            return 0;
        }
        const logSum = this.log[a]! + this.log[b]!;
        return this.exp[logSum]!;
    }

    /**
     * Performs division in the Galois Field.
     * @param a - Numerator (byte).
     * @param b - Denominator (byte, must not be zero).
     * @returns The result of a / b in GF(2^8).
     * @throws Error if b is zero or inputs are invalid.
     */
    div(a: number, b: number): number {
        GF256.validateByte(a, "a");
        GF256.validateByte(b, "b");

        if (b === 0) {
            throw new Error("division by zero");
        }
        if (a === 0) {
            return 0;
        }
        let logDiff = this.log[a]! - this.log[b]!;
        if (logDiff < 0) {
            logDiff += 255;
        }
        return this.exp[logDiff]!;
    }

    /**
     * Returns the multiplicative inverse in the Galois Field.
     * @param a - Value to invert (must not be zero).
     * @returns The multiplicative inverse of a in GF(2^8).
     * @throws Error if a is zero or not a valid byte.
     */
    inv(a: number): number {
        GF256.validateByte(a, "a");

        if (a === 0) {
            throw new Error("no inverse for 0");
        }
        return this.exp[255 - this.log[a]!]!;
    }

    /**
     * Performs addition in GF(2^8).
     * @param a - First operand (byte).
     * @param b - Second operand (byte).
     * @returns The result of a + b in GF(2^8).
     */
    add(a: number, b: number): number {
        GF256.validateByte(a, "a");
        GF256.validateByte(b, "b");

        return a ^ b;
    }

    /**
     * Performs subtraction in GF(2^8).
     * @param a - First operand (byte).
     * @param b - Second operand (byte).
     * @returns The result of a - b in GF(2^8).
     */
    sub(a: number, b: number): number {
        GF256.validateByte(a, "a");
        GF256.validateByte(b, "b");

        return a ^ b;
    }

    /**
     * Debug utility to print the tables.
     */
    printTables(): void {
        console.log(`Printing tables for Galois Field (poly=${this.poly.toString(16)}, gen=${this.gen.toString(16)})`);

        console.log("\nLog Table:");
        for (let i = 0; i < 16; i++) {
            let row = "";
            for (let j = 0; j < 16; j++) {
                const idx = i * 16 + j;
                row += this.log[idx]?.toString(16).padStart(2, "0") + " ";
            }
            console.log(row);
        }

        console.log("\nExp Table:");
        for (let i = 0; i < 16; i++) {
            let row = "";
            for (let j = 0; j < 16; j++) {
                const idx = i * 16 + j;
                row += this.exp[idx]?.toString(16).padStart(2, "0") + " ";
            }
            console.log(row);
        }

        console.log();
    }

    /**
     * Evaluates a polynomial using Horner's method for x.
     * @param coefficients - Polynomial coefficients in increasing order.
     * @param x - The x-value to evaluate the polynomial at (must not be zero).
     * @returns The evaluated result.
     * @throws Error if x is zero or invalid.
     */
    evaluate(coefficients: Uint8Array, x: number): number {
        GF256.validateByte(x, "x");

        if (coefficients.length === 0) {
            throw new Error("cannot evaluate an empty polynomial");
        }
        if (x === 0) {
            throw new Error("cannot evaluate at x = 0");
        }

        const degree = coefficients.length - 1;
        let result = coefficients[degree];

        for (let i = degree - 1; i >= 0; i--) {
            result = this.mul(result!, x);
            result = this.add(result, coefficients[i]!);
        }

        return result!;
    }

    /**
     * Takes n sample points and uses Lagrange Interpolation to determine the value at x.
     * @param samples - Array of sample points (x, y) to interpolate.
     * @param x - The x-value at which to interpolate.
     * @returns The interpolated result at x.
     */
    interpolate(samples: Point[], x: number): number {
        GF256.validateByte(x, "x");

        if (samples.length === 0) {
            throw new Error("at least one sample point is required");
        }

        let basis = 0;
        let result = 0;

        for (let i = 0; i < samples.length; i++) {
            basis = 1;
            const si = samples[i]!;

            for (let j = 0; j < samples.length; j++) {
                if (i === j) {
                    continue;
                }

                const sj = samples[j]!;

                const num = this.add(x, sj.x);
                const den = this.add(si.x, sj.x);
                const term = this.div(num, den);
                basis = this.mul(basis, term);
            }

            result = this.add(result, this.mul(si.y, basis));
        }

        return result;
    }

    /**
     * Adds two polynomials in the field.
     * @param a - First polynomial
     * @param b - Second polynomial
     * @returns The sum polynomial
     */
    addPolynomials(a: Uint8Array, b: Uint8Array): Uint8Array {
        const result = new Uint8Array(Math.max(a.length, b.length));
        
        // Copy coefficients from a
        for (let i = 0; i < a.length; i++) {
            result[i] = a[i]!;
        }
        
        // Add coefficients from b
        for (let i = 0; i < b.length; i++) {
            result[i] = this.add(result[i] || 0, b[i]!);
        }
        
        return result;
    }

    /**
     * Multiplies two polynomials in the field.
     * @param a - First polynomial
     * @param b - Second polynomial
     * @returns The product polynomial
     */
    mulPolynomials(a: Uint8Array, b: Uint8Array): Uint8Array {
        if (a.length === 0 || b.length === 0) {
            return new Uint8Array(0);
        }
        
        const result = new Uint8Array(a.length + b.length - 1);
        
        for (let i = 0; i < a.length; i++) {
            for (let j = 0; j < b.length; j++) {
                const idx = i + j;
                const product = this.mul(a[i]!, b[j]!);
                result[idx] = this.add(result[idx]!, product);
            }
        }
        
        return result;
    }

    /**
     * Returns a list of all valid generator elements for the field defined by the provided polynomial.
     * @param poly - The irreducible polynomial to test generators against.
     * @returns An array of all valid generator values for this polynomial.
     */
    static findAllGenerators(poly: number): number[] {
        GF256.validateUInt16(poly, "polynomial");

        const generators: number[] = [];

        for (let i = 2; i < 255; i++) {
            if (GF256.isGenerator(poly, i)) {
                generators.push(i);
            }
        }

        return generators;
    }

    /**
     * Checks whether gen is a generator for the field defined by the provided polynomial.
     * @param poly - The irreducible polynomial.
     * @param gen - The candidate generator to test.
     * @returns Whether gen is is a valid generator in the field defined by poly.
     */
    static isGenerator(poly: number, gen: number): boolean {
        GF256.validateUInt16(poly, "polynomial");
        GF256.validateByte(gen, "generator");

        const fieldSize = 255; // GF(2^8) has 255 non-zero elements

        const seen = new Set<number>();
        let x = 1;

        for (let i = 0; i < fieldSize; i++) {
            if (seen.has(x)) {
                return false; // duplicate => not primitive
            }
            seen.add(x);
            x = GF256.mulByte(x, gen, poly);
        }

        return seen.size === fieldSize;
    }

    /**
     * Multiplies two bytes in GF(2^8) without log/exp (used during table generation).
     * @param a - First byte operand.
     * @param b - Second byte operand.
     * @param poly - The irreducible polynomial used for reduction.
     * @returns The result of multiplication in GF(2^8).
     */
    static mulByte(a: number, b: number, poly: number): number {
        GF256.validateByte(a, "a");
        GF256.validateByte(b, "b");
        GF256.validateUInt16(poly, "polynomial");

        let res = 0;
        for (let i = 0; i < 8; i++) {
            if ((b & 1) !== 0) {
                res ^= a;
            }
            const hi = a & 0x80;
            a <<= 1;
            if (hi !== 0) {
                a ^= poly & 0xff;
            }
            b >>= 1;
        }
        return res & 0xff;
    }


    /**
     * Generates a random polynomial of the given degree over GF(2^8),
     * with the constant term (intercept) set explicitly.
     *
     * This is useful for Shamir Secret Sharing and other schemes that require
     * randomly constructed polynomials over a finite field.
     *
     * @param intercept - The constant term (f(0)) of the polynomial.
     * @param degree - The degree of the polynomial (number of random coefficients).
     * @returns A Uint8Array of length (degree + 1), where index 0 is the intercept.
     */
    static makePolynomial(intercept: number, degree: number): Uint8Array {
        GF256.validateByte(intercept, "intercept");

        if (degree < 0) {
            throw new Error("degree must be non-negative");
        }

        const coefficients = new Uint8Array(degree + 1);
        coefficients[0] = intercept;

        const randomCoefficients = randomBytes(degree);
        for (let i = 0; i < degree; i++) {
            coefficients[i + 1] = randomCoefficients[i]!;
        }

        return coefficients;
    }

    /**
     * Validates that a number is within the valid byte range [0, 256).
     * @throws Error if the number is outside the valid range.
     */
    private static validateByte(n: number, paramName: string = "value"): void {
        if (!Number.isInteger(n) || n < 0 || n > 255) {
            throw new Error(`${paramName} must be a byte (0-255), got ${n}`);
        }
    }

    /**
     * Validates that a number is within the valid uint16 range [0, 65536).
     * @throws Error if the number is outside the valid range.
     */
    private static validateUInt16(n: number, paramName: string = "value"): void {
        if (!Number.isInteger(n) || n < 0 || n > 65535) {
            throw new Error(`${paramName} must be a uint16 (0-65535), got ${n}`);
        }
    }
}
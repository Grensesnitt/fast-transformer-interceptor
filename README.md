# FastTransformInterceptor Usage Documentation

![CI](https://github.com/Grensesnitt/fast-transformer-interceptor/workflows/CI/badge.svg)

The `FastTransformInterceptor` is a powerful tool for automatically transforming and validating your API responses in NestJS applications. This document covers all the possibilities and features of the transformer.

## Table of Contents

1. [Installation](#installation)
2. [Configuration](#configuration)
3. [Basic Usage](#basic-usage)
4. [Decorators](#decorators)
   - [@ResponseType](#responsetype)
   - [@NoCheck](#nocheck)
   - [@NoOut](#noout)
   - [@NoCheckPrimitives](#nocheckprimitives)
5. [DTO Configuration](#dto-configuration)
6. [Transformation Behavior](#transformation-behavior)
7. [DTO Property Types and Behaviors](#dto-property-types-and-behaviors)
8. [Error Handling](#error-handling)
9. [Advanced Features](#advanced-features)
10. [Best Practices](#best-practices)

## Showcase

fast-transform-interceptor is both fast and easy to use. Normally it will return about 5-10 times faster than using class-transformer.

```typescript
// Using Sequelize model in service
class User extends Model {
    @Column
    username: string;
    
    @Column
    password: string;
}

class UserDto {
    username: string;
}

class UserService {
    async getUsers(): Promise<User> {
        // We return Sequelize objects
        return this.userModel.findAll();
    }
}

class UserController {
    @Get()
    @ResponseType({type: UserDto})
    async getAll() {
        // Still no conversion from the Sequelize objects
        return this.userService.getUsers();
    }
}
```

This returns only username in the api result. And if you use the swagger cli plugin for documentation, you will normally get correct types on all the results as in documentation.

## Installation

Before using the `FastTransformInterceptor`, make sure you have the `@nestjs/swagger` package installed. You can install it using npm or yarn:

```bash
npm install --save @nestjs/swagger fast-transform-interceptor
# or
yarn add @nestjs/swagger fast-transform-interceptor
```

## Configuration

After installing the `@nestjs/swagger` package, you need to configure the Swagger plugin in your `nest-cli.json` file. This step is crucial for the `FastTransformInterceptor` to work correctly.

1. Open your `nest-cli.json` file (create one in your project root if it doesn't exist).

2. Add or modify the `plugins` section to include the Swagger plugin:

```json
{
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "plugins": [
      {
        "name": "@nestjs/swagger",
        "options": {
          "classValidatorShim": true,
          "introspectComments": true
        }
      }
    ]
  }
}
```

This configuration enables the Swagger plugin, which is necessary for the `FastTransformInterceptor` to correctly process the DTO metadata.

You do not need to start the swagger documentation for `FastTransformInterceptor` to work.

## Global Configuration

When setting up the `FastTransformInterceptor`, you can provide default values for the response structure. These defaults are used when not overridden by the `@ResponseType` decorator.

```typescript
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { FastTransformInterceptor } from './fast-transform.interceptor';

@Module({
  providers: [
     {
        provide: APP_INTERCEPTOR,
        useFactory: (reflector: Reflector) => {
           return new FastTransformInterceptor({
              reflector
           });
        },
        inject: [Reflector]
     },
  ],
})
export class AppModule {}
```

Or a more feature-rich setup:

```typescript
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { FastTransformInterceptor } from './fast-transform.interceptor';

@Module({
  providers: [
     {
        provide: APP_INTERCEPTOR,
        useFactory: (reflector: Reflector, configService: ConfigService) => {
           return new FastTransformInterceptor({
              reflector,
              debug: configService.get<boolean>("debug"),
              defaultResponse: { meta: null, data: null },
              defaultResponseKey: "data",
              defaultDataKey: null
           });
        },
        inject: [Reflector, ConfigService]
     },
  ],
})
export class AppModule {}
```

- `defaultResponse`: The default structure of the response object.
- `defaultResponseKey`: The key where the transformed data will be placed in the response object.
- `defaultDataKey`: The key to look for the data in the controller's response. If null, the entire response is considered as data.

## Decorators
### @ResponseType Decorator

The `@ResponseType` decorator allows you to specify the DTO type for the response and override the default configuration on a per-route basis.

```typescript
@ResponseType({
  type: UserDto,
  response?: any,
  responseKey?: string,
  dataKey?: string | null,
  noTransform?: boolean,
  status?: number,
  additionalProperties?: Record<string, any>
})
```

- `type`: The DTO class to use for transformation (required)
- `response`: Override the default response structure for this route
- `responseKey`: Override the default response key for this route
- `dataKey`: Override the default data key for this route
- `noTransform`: Skip transformation for this response (default: `false`)
- `status`: HTTP status code for the response (default: 200)
- `additionalProperties`: Additional properties to include in the response

### Examples

1. Using global defaults:

```typescript
@Get()
@ResponseType({ type: UserDto })
getUsers() {
  // This will use the global default configuration
}
```

2. Overriding response structure:

```typescript
@Get()
@ResponseType({
  type: UserDto,
  response: { success: true, result: null },
  responseKey: "result"
})
getUsers() {
  // This will override the response structure and key
}
```

3. Specifying a data key:

```typescript
@Get()
@ResponseType({
  type: UserDto,
  dataKey: "users"
})
getUsers() {
  // This expects the controller to return { users: [...] }
  // and will transform the content of the "users" key
}
```

4. Disabling transformation:

```typescript
@Get()
@ResponseType({
  type: UserDto,
  noTransform: true
})
getRawUsers() {
  // This will skip the transformation process
}
```

By using these configuration options and the `@ResponseType` decorator, you can fine-tune how your API responses are structured and transformed on both a global and per-route basis.

### @NoCheck

The `@NoCheck` decorator can be used on a DTO class or property to skip validation for that class or property.

```typescript
import { NoCheck } from './decorators/no-check.decorator';

@NoCheck()
export class PartialUserDto {
  // Properties here won't be checked
}

export class UserDto {
  @NoCheck()
  flexibleField: any;
}
```

### @NoOut

The `@NoOut` decorator can be used on a DTO property to exclude it from the output.

```typescript
import { NoOut } from './decorators/no-out.decorator';

export class UserDto {
  @NoOut()
  password: string;
}
```

### @NoCheckPrimitives

The `@NoCheckPrimitives` decorator can be used on a DTO class to skip validation for all primitive type properties within that class. This can be useful for improving performance when type checking is not critical for primitive values.

```typescript
import { NoCheckPrimitives } from './decorators/no-check-primitives.decorator';

@NoCheckPrimitives()
export class PerformanceOptimizedDto {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: Date;
  // These primitive properties will not be type-checked during transformation
  
  nestedObject: ComplexDto; // Non-primitive types are still validated and transformed
}
```

When `@NoCheckPrimitives` is applied to a DTO:
- All primitive type properties (number, string, boolean, bigint, symbol, Date) are passed through as-is without type checking.
- Non-primitive types (e.g., nested objects, arrays of objects) are still validated and transformed as usual.
- This decorator affects only the class it's applied to, not any nested DTOs.
- For nested objects and arrays, the `@NoCheckPrimitives` decorator will still be respected for their primitive properties.

Use this decorator with caution, as it bypasses type safety for primitives. It's best used in scenarios where you're confident about the types of incoming data and prioritize performance over strict type checking.

## DTO Configuration

DTOs (Data Transfer Objects) are configured using TypeScript types and decorators. The `FastTransformInterceptor` uses this information to validate and transform the response data. Here are various ways to define properties in your DTOs and how they are handled:

### Basic Types

```typescript
export class UserDto {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: Date;
  bigNumber: bigint;
  uniqueSymbol: symbol;
}
```

These primitive types are validated during transformation. If a value doesn't match its declared type, the transformer will attempt to coerce it to the correct type. If coercion fails, a `TransformError` will be thrown.

### Complex Types

```typescript
import { AddressDto } from './address.dto';

export class UserDto {
  details: {
    age: number;
    hobbies: string[];
  };
  address: AddressDto;
  friends: UserDto[];
}
```

- Nested objects are recursively transformed.
- Arrays of primitive types or complex types are handled accordingly.

### Enum Types

```typescript
enum UserRole {
  Admin = 'ADMIN',
  User = 'USER',
  Guest = 'GUEST'
}

export class UserDto {
  role: UserRole;
}
```

Enum types are validated against their defined values.

### Nullable and Optional Types

```typescript
export class UserDto {
  middleName: string | null;
  nickname?: string;
  deletedAt?: Date | null;
}
```

- Nullable types (using `| null`) allow either the specified type or null.
- Optional properties (marked with `?`) can be undefined and will be skipped if not present.
- Required properties that are undefined will throw a `TransformError`.

### Using Decorators

```typescript
import { NoCheck } from './decorators/no-check.decorator';
import { NoOut } from './decorators/no-out.decorator';

export class UserDto {
  @NoCheck()
  flexibleField: any;

  @NoOut()
  password: string;
}
```

- `@NoCheck()` skips validation for the decorated property.
- `@NoOut()` excludes the decorated property from the output.

### Class-level Decorators

```typescript
import { NoCheckPrimitives } from './decorators/no-check-primitives.decorator';

@NoCheckPrimitives()
export class PerformanceOptimizedDto {
  id: number;
  name: string;
  isActive: boolean;
  // Primitive properties won't be type-checked
  
  complexField: ComplexDto; // Still validated and transformed
}
```

`@NoCheckPrimitives()` skips validation for all primitive type properties in the class, improving performance when strict type checking isn't necessary.

Remember, the `FastTransformInterceptor` uses these DTO configurations to ensure your API responses are consistent, validated, and well-structured. Always design your DTOs to accurately represent your data model and API contracts.

## Transformation Behavior

The transformer handles different types of data:

1. Primitive types (string, number, boolean, bigint, symbol, Date): Checked for correct type and coerced if possible
2. Classes: Recursively transformed
3. Arrays of classes or primitives: Each item is recursively transformed or validated
4. Enums: Validated against enum values

Sequelize models are automatically converted to plain objects before transformation. This is done by checking for a 'get' function and calling it with { plain: true }.

The transformer uses a caching mechanism to store prepared metadata for DTOs, which improves performance for subsequent transformations of the same DTO type.

## DTO Property Types and Behaviors

This section details the various ways you can define properties in your DTOs and how the `FastTransformInterceptor` handles them.

### Basic Types

1. `test: number;`
   - Treated as a primitive type.
   - If the value is not a number, it will try to convert to number. If conversion fails, it will throw a `TransformError`.

2. `test: string;`
   - Treated as a primitive type.
   - If the value is not a string, it will try to convert to string. If conversion fails, it will throw a `TransformError`.

3. `test: boolean;`
   - Treated as a primitive type.
   - If the value is not a boolean, it will try to convert to boolean. If conversion fails, it will throw a `TransformError`.

4. `test: bigint;`
   - Treated as a primitive type.
   - If the value is not a bigint, it will try to convert to bigint. If conversion fails, it will throw a `TransformError`.

5. `test: symbol;`
   - Treated as a primitive type.
   - If the value is not a symbol, it will throw a `TransformError`.

6. `test: Date;`
   - Treated as a primitive type.
   - If the value is not a valid Date object, it will try to create a new Date from the value. If this fails, it will throw a `TransformError`.

### Complex Types

1. `test: SomeDto;`
   - Treated as a class type.
   - Recursively transformed using the `SomeDto` class definition.
   - The transformer will apply the same rules to all properties of `SomeDto`.

2. `test: SomeDto[];`
   - Treated as an array of a class type.
   - Each item in the array is recursively transformed using the `SomeDto` class definition.
   - If the value is not an array, it will throw a `TransformError`.

3. `test: SomeEnum;`
   - Treated as an enum type.
   - Validated against the enum values.
   - If the value is not one of the enum values, it will throw a `TransformError`.

### Nullable and Optional Types

1. `test: string | null;`
   - Allows either a string value or null.
   - If the value is a string, it's passed through as-is.
   - If the value is null, it's allowed.
   - Any other type will throw a `TransformError`.

2. `test?: string;`
   - Optional property (can be undefined).
   - If present, must be a string.
   - If absent (undefined), it's skipped during transformation.

3. `test?: string | null;`
   - Optional property that can be a string, null, or undefined.
   - If present and a string, it's passed through as-is.
   - If null, it's allowed.
   - If absent (undefined), it's skipped during transformation.

### Special Decorators

1. `@NoCheck() test: any;`
   - The `@NoCheck()` decorator skips validation for this property.
   - Any value is allowed and passed through as-is.

2. `@NoOut() test: string;`
   - The `@NoOut()` decorator excludes this property from the output.
   - It won't appear in the transformed result.

3. `@NoCheckPrimitives() class SomeDto { ... }`
   - The `@NoCheckPrimitives()` decorator skips validation for all primitive types in this class.
   - Primitive values (number, string, boolean, bigint, symbol, Date) are passed through as-is without type checking.
- Non-primitive types are still validated and transformed as usual.
   - This decorator affects nested objects and arrays within the class, respecting the no-check behavior for their primitive properties.

### Behavior Notes

- The transformer attempts to coerce primitive types to their declared type before throwing an error.
- Class types and arrays of class types are recursively transformed.
- Enum types are validated against their defined values.
- Nullable types allow null values in addition to their base type.
- Optional properties (marked with `?`) are skipped if they're undefined.
- Required properties that are undefined will throw a `TransformError`.
- The `@NoCheck()` decorator can be used on individual properties or entire classes to skip validation.
- The `@NoOut()` decorator excludes properties from the final output.
- The `@NoCheckPrimitives()` decorator affects all primitive properties in a class, including those in nested objects and arrays.

By understanding these behaviors, you can design your DTOs to precisely control how your API responses are transformed and validated.

## Error Handling

The transformer throws a `TransformError` when it encounters validation issues. To enable detailed error information, you need to set the `debug` configuration to `true` in the initialization of FastTransformInterceptor:

```typescript
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { FastTransformInterceptor } from './fast-transform.interceptor';

@Module({
  providers: [
     {
        provide: APP_INTERCEPTOR,
        useFactory: (reflector: Reflector) => {
           return new FastTransformInterceptor({
              reflector,
              debug: true
           });
        },
        inject: [Reflector]
     },
  ],
})
export class AppModule {}
```

With debug mode enabled, the error response will include detailed information in the following structure:

```typescript
{
  message: string; // A general error message
  debug: {
    dtoName: string;
    fieldName: string;
    receivedValue: any;
    expectedType?: string;
    expectedValues?: any[];
    fullObject: any;
    filter: Record<string, any>;
    stack?: string;
  }
}
```

These errors are caught and converted to `BadRequestException` with appropriate error messages and debug information when available.

## Debug Timing

The `FastTransformInterceptor` includes a debug timing feature to help you measure the performance of the transformation process. To enable debug timing:

1. Set the `debug` configuration to `true`.

2. When debug mode is enabled, the interceptor will log the time taken for each transformation using `console.time()` and `console.timeEnd()`.

3. The timing information will be logged with the label "fast-transform" for each request.

Example output:

```
fast-transform: 5.123ms
```

This feature can help you identify performance bottlenecks in your DTO transformations and optimize your API responses.

## Advanced Features

### Caching Mechanism

The `FastTransformInterceptor` uses an internal caching mechanism to store prepared metadata for DTOs. This optimization significantly improves performance for subsequent transformations of the same DTO type. The cache is implemented using a `Map` and is automatically managed by the interceptor.

### Handling of Sequelize Models

When dealing with Sequelize models, the interceptor automatically converts them to plain objects before transformation. This is done by checking for a 'get' function on the object and calling it with `{ plain: true }`. This ensures that Sequelize-specific properties are stripped away and only the actual data is transformed.

## Best Practices

1. Always use the `@ResponseType` decorator on controller methods that return data.

2. Keep your DTOs simple and focused. Use composition for complex structures.

3. Use the `@NoCheck` decorator sparingly, only when absolutely necessary.

4. Leverage the `@NoOut` decorator to exclude sensitive information from responses.

5. Enable debug mode during development for detailed error information and performance metrics.

6. Regularly review and update your DTOs to ensure they match your API contracts.

7. Use TypeScript's strict mode to catch potential issues early in development.

8. Use the `@NoCheckPrimitives` decorator on DTOs with many primitive fields to improve performance when type checking is not critical.

9. Monitor the debug timing outputs to identify and optimize slow transformations.

10. Be aware of how undefined and null values are handled in your DTOs and adjust your designs accordingly.

11. Take advantage of the coercion behavior for primitive types, but be cautious about relying on it for critical data integrity.

12. When working with Sequelize models, be aware that they will be automatically converted to plain objects during transformation.

By following these guidelines and leveraging the full capabilities of the `FastTransformInterceptor`, you can ensure consistent, validated, and well-structured API responses in your NestJS application while maintaining high performance.
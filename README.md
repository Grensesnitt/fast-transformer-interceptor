# FastTransformInterceptor Usage Documentation

The `FastTransformInterceptor` is a powerful tool for automatically transforming and validating your API responses in NestJS applications. This document covers all the possibilities and features of the transformer.

## Table of Contents

1. [Installation](#installation)
2. [Configuration](#configuration)
2. [Basic Usage](#basic-usage)
2. [Decorators](#decorators)
    - [@ResponseType](#responsetype)
    - [@NoCheck](#nocheck)
    - [@NoOut](#noout)
    - [@NoCheckPrimitives](#nocheckprimitives)
3. [DTO Configuration](#dto-configuration)
4. [Transformation Behavior](#transformation-behavior)
5. [DTO Property Types and Behaviors](#dto-property-types-and-behaviors)
5. [Error Handling](#error-handling)
6. [Advanced Features](#advanced-features)
7. [Best Practices](#best-practices)

## Installation

Before using the `FastTransformInterceptor`, make sure you have the `@nestjs/swagger` package installed. You can install it using npm or yarn:

```bash
npm install --save @nestjs/swagger
# or
yarn add @nestjs/swagger
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
  status?: number
})
```

- `type`: The DTO class to use for transformation (required)
- `response`: Override the default response structure for this route
- `responseKey`: Override the default response key for this route
- `dataKey`: Override the default data key for this route
- `noTransform`: Skip transformation for this response (default: `false`)
- `status`: HTTP status code for the response (default: 200)

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

These primitive types are passed through as-is during transformation. If a value doesn't match its declared type, a `TransformError` will be thrown.

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

1. Primitive types (string, number, boolean): Passed through as-is
2. Classes: Recursively transformed
3. Arrays of classes: Each item is recursively transformed
4. Enums: Validated against enum values

Sequelize models are automatically converted to plain objects before transformation.

## DTO Property Types and Behaviors

This section details the various ways you can define properties in your DTOs and how the `FastTransformInterceptor` handles them.

### Basic Types

1. `test: number;`
   - Treated as a primitive type.
   - Passed through as-is during transformation.
   - If the value is not a number, it will throw a `TransformError`.

2. `test: string;`
   - Treated as a primitive type.
   - Passed through as-is during transformation.
   - If the value is not a string, it will throw a `TransformError`.

3. `test: boolean;`
   - Treated as a primitive type.
   - Passed through as-is during transformation.
   - If the value is not a boolean, it will throw a `TransformError`.

4. `test: bigint;`
   - Treated as a primitive type.
   - Passed through as-is during transformation.
   - If the value is not a bigint, it will throw a `TransformError`.

5. `test: symbol;`
   - Treated as a primitive type.
   - Passed through as-is during transformation.
   - If the value is not a symbol, it will throw a `TransformError`.

6. `test: Date;`
   - Treated as a primitive type.
   - Passed through as-is during transformation.
   - If the value is not a valid Date object, it will throw a `TransformError`.
   - 
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
    - If absent, it's skipped during transformation.

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

### Behavior Notes

- The transformer handles primitive types (number, string, boolean) by passing them through as-is.
- Class types and arrays of class types are recursively transformed.
- Enum types are validated against their defined values.
- Nullable types allow null values in addition to their base type.
- Optional properties (marked with `?`) are skipped if they're undefined.
- The `@NoCheck()` decorator can be used on individual properties or entire classes to skip validation.
- The `@NoOut()` decorator excludes properties from the final output.

By understanding these behaviors, you can design your DTOs to precisely control how your API responses are transformed and validated.

## Error Handling

The transformer throws a `TransformError` when it encounters validation issues. To enable detailed error information, you need to set the `debug` configuration to `true` in your `ConfigService`.

Here's how you can configure it:

1. In your configuration file (e.g., `config.ts` or `environment.ts`):

```typescript
export default () => ({
  debug: process.env.DEBUG === 'true' || false,
  // ... other configuration options
});
```

2. When creating the `ConfigService`, make sure to load this configuration:

```typescript
import { ConfigModule } from '@nestjs/config';
import config from './config';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [config],
    }),
    // ... other imports
  ],
  // ... providers, etc.
})
export class AppModule {}
```

With debug mode enabled, the error response will include detailed information, including:

- DTO name
- Field name
- Received value
- Expected type or values
- Full object being transformed
- Filter used for transformation

These errors are caught and converted to `BadRequestException` with appropriate error messages.

## Debug Timing

The `FastTransformInterceptor` includes a debug timing feature to help you measure the performance of the transformation process. To enable debug timing:

1. Set the `debug` configuration to `true` in your `ConfigService` as described in the Error Handling section.

2. When debug mode is enabled, the interceptor will log the time taken for each transformation using `console.time()` and `console.timeEnd()`.

3. The timing information will be logged with the label "fast-transform" for each request.

Example output:

```
fast-transform: 5.123ms
```

This feature can help you identify performance bottlenecks in your DTO transformations and optimize your API responses.

## Best Practices

1. Always use the `@ResponseType` decorator on controller methods that return data.

2. Keep your DTOs simple and focused. Use composition for complex structures.

3. Use the `@NoCheck` decorator sparingly, only when absolutely necessary.

4. Leverage the `@NoOut` decorator to exclude sensitive information from responses.

5. Enable debug mode during development for detailed error information.

6. Regularly review and update your DTOs to ensure they match your API contracts.

7. Use TypeScript's strict mode to catch potential issues early in development.

9. Use the `@NoCheckPrimitives` decorator on DTOs with many primitive fields to improve performance when type checking is not critical.

9. Monitor the debug timing outputs to identify and optimize slow transformations.

By following these guidelines and leveraging the full capabilities of the `FastTransformInterceptor`, including the new primitives support and performance features, you can ensure consistent, validated, and well-structured API responses in your NestJS application.
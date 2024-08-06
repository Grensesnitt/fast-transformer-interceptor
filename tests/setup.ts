import { FastTransformInterceptor } from '../src';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { Reflector } from '@nestjs/core';

// Helper function to mock DTO metadata
export function mockDtoMetadata(dto: any, metadata: Record<string, any>) {
    (dto as any)._OPENAPI_METADATA_FACTORY = () => metadata;
}

// Helper function to create a mock execution context
export function createMockExecutionContext(): ExecutionContext {
    return {
        getHandler: () => {},
        getClass: () => {},
    } as ExecutionContext;
}

// Helper function to create a mock call handler
export function createMockCallHandler(data: any): CallHandler {
    return {
        handle: () => of(data),
    } as CallHandler;
}

// Helper function to set up the interceptor and mock the reflector
export function setupInterceptor(dtoType: any): [FastTransformInterceptor, jest.Mock] {
    const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue({ type: dtoType }),
    } as any;
    const interceptor = new FastTransformInterceptor({ reflector, debug: false });
    return [interceptor, reflector.getAllAndOverride];
}

// Helper function to run the interceptor and get the result
export async function runInterceptor(interceptor: FastTransformInterceptor, inputData: any) {
    const mockExecutionContext = createMockExecutionContext();
    const mockCallHandler = createMockCallHandler(inputData);
    return await interceptor.intercept(mockExecutionContext, mockCallHandler).toPromise();
}
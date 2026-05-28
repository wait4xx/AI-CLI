/**
 * 测试全局 setup
 * 导入 @testing-library/jest-dom 扩展 Vitest 匹配器
 */
import * as matchers from '@testing-library/jest-dom/matchers'
import { expect } from 'vitest'

expect.extend(matchers)

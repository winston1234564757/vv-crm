# VV-CRM Critical Issues Plan

## Goal
Fix critical production-blocking issues in VV-CRM codebase, specifically form validation, component size, and user experience problems.

## Tasks
- [x] Task 1: Extract form validation logic into dedicated validation module → Verify: Run tests, check validation functions work
- [x] Task 2: Split SaleForm component into smaller focused components → Verify: Check component file sizes < 100 lines each
- [x] Task 3: Add comprehensive input validation to all forms → Verify: Test invalid inputs rejected, valid inputs accepted
- [x] Task 4: Fix React hooks issues (useEffect/setState) → Verify: Run ESLint, check for React warnings
- [x] Task 5: Add form-level validation and error handling → Verify: Test form submission with invalid data
- [x] Task 6: Extract business logic from DeviceForm → Verify: Check DeviceForm size reduced to < 200 lines
- [x] Task 7: Add validation utilities for phone, email, price, discount → Verify: Test all validation functions
- [x] Task 8: Implement real-time validation feedback → Verify: Check UI shows validation errors immediately
- [x] Task 9: Add form-level success/error state management → Verify: Test form submission flow
- [x] Task 10: Create comprehensive test suite for forms → Verify: All form tests passing

## Done When
- [x] All validation tests passing
- [x] Component sizes reduced appropriately
- [x] ESLint errors resolved
- [x] Form functionality verified

## Notes
Critical production-blocking issues identified:
- SaleForm: 422 lines (should be < 100)
- DeviceForm: 528 lines (should be < 200)
- No form validation infrastructure
- React hooks warnings causing cascading renders
- Manual inputs without validation
- Poor error handling and user feedback

Files to modify: src/components/forms/SaleForm.tsx, DeviceForm.tsx, CustomerForm.tsx
Add new files: src/lib/validation/, tests for forms
Dependencies: None (pure validation logic)

Project-specific scripts:
- For form validation: Use custom validation utilities
- For component testing: Use vitest for React components
- For code quality: Use ESLint with custom rules for React hooks
# VV-CRM Critical Issues Plan

## Goal
Fix critical production-blocking issues in VV-CRM codebase, specifically form validation, component size, and user experience problems.

## Tasks
- [ ] Task 1: Extract form validation logic into dedicated validation module → Verify: Run tests, check validation functions work
- [ ] Task 2: Split SaleForm component into smaller focused components → Verify: Check component file sizes < 100 lines each
- [ ] Task 3: Add comprehensive input validation to all forms → Verify: Test invalid inputs rejected, valid inputs accepted
- [ ] Task 4: Fix React hooks issues (useEffect/setState) → Verify: Run ESLint, check for React warnings
- [ ] Task 5: Add form-level validation and error handling → Verify: Test form submission with invalid data
- [ ] Task 6: Extract business logic from DeviceForm → Verify: Check DeviceForm size reduced to < 200 lines
- [ ] Task 7: Add validation utilities for phone, email, price, discount → Verify: Test all validation functions
- [ ] Task 8: Implement real-time validation feedback → Verify: Check UI shows validation errors immediately
- [ ] Task 9: Add form-level success/error state management → Verify: Test form submission flow
- [ ] Task 10: Create comprehensive test suite for forms → Verify: All form tests passing

## Done When
- [ ] All validation tests passing
- [ ] Component sizes reduced appropriately
- [ ] ESLint errors resolved
- [ ] Form functionality verified

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
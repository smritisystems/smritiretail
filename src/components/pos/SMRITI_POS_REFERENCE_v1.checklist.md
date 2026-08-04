# SMRITI UX Review Checklist for SMRITI_POS_REFERENCE_v1

## Visual (25)
- [ ] Surface hierarchy is clear and consistent
- [ ] Spacing feels intentional and even across sections
- [ ] Typography hierarchy is correct for headings, labels, and body text
- [ ] Color usage is restrained and purposeful
- [ ] Shadows are soft and used for elevation only
- [ ] Border radius is consistent across cards and buttons
- [ ] Buttons have distinct primary and secondary states
- [ ] Icons are simple, recognizable, and visually balanced
- [ ] Card surfaces have no heavy stroke borders
- [ ] Dark mode remains legible and not oversaturated

## Interaction (25)
- [ ] Hover states are visible and consistent
- [ ] Focus ring and keyboard navigation are clear
- [ ] Button hit areas are at least 44x44px
- [ ] Action states are obvious on click or tap
- [ ] Inline edit controls are easy to discover
- [ ] Search input has visible focus/active state
- [ ] Sticky header remains stable when scrolling
- [ ] Bottom action bar is reachable and centered
- [ ] Action buttons maintain spacing and weight
- [ ] No more than 5 primary actions in the top header row

## Accessibility (25)
- [ ] Text contrast meets WCAG AA for body text
- [ ] Icon buttons have accessible labels
- [ ] Disabled states are visibly distinct
- [ ] Status indicators are clear (active, held, paid)
- [ ] Focus states exist for all interactive elements
- [ ] Inputs have sufficient label or aria-label support
- [ ] Table row readability remains high in both modes
- [ ] No hidden interactive elements without disclosure
- [ ] Modal dialogs trap focus and close with ESC
- [ ] Color is not the only state indicator

## Responsiveness (25)
- [ ] Desktop layout is balanced and not crowded
- [ ] Tablet layout retains sidebar + content clarity
- [ ] Mobile layout is usable without sidebar overload
- [ ] Content stacks naturally on smaller screens
- [ ] Buttons remain large enough for touch
- [ ] Search and customer controls remain visible
- [ ] Header stays within 56-64px height
- [ ] Bottom action bar floats safely above page chrome
- [ ] Grid and summary cards remain legible when narrower
- [ ] Screen can be evaluated without horizontal scroll

## Acceptance
- [ ] Total score: 90/100 or higher
- [ ] Only POS reference components use the new tokens until approval
- [ ] No other modules are migrated until this screen is frozen
- [ ] Design freeze manifest exists: `SMRITI_POS_REFERENCE_v1.json`
- [ ] No global theme file changes are included in this freeze phase

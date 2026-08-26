/**
 * Expose the shared DropdownMenu family through the application UI package.
 * Call sites should import from `@pure/ui`; swap for a local implementation later.
 */
export {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuItem,
  DropdownMenuItemContent,
  DropdownMenuItemExtra,
  DropdownMenuItemIcon,
  DropdownMenuItemLabel,
  DropdownMenuPopup,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  DropdownMenuRoot,
  DropdownMenuSubmenuArrow,
  DropdownMenuSubmenuRoot,
  DropdownMenuSubmenuTrigger,
  DropdownMenuTrigger,
  renderDropdownMenuItems,
  type MenuInfo,
  type MenuProps,
} from '@lobehub/ui'

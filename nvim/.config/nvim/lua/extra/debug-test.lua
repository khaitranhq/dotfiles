-- debug-test.lua
-- Simple test file for debugging nui UI issues

local function test_simple_select()
  -- Test with simple strings first
  vim.ui.select({"Option 1", "Option 2", "Option 3"}, {
    prompt = "Simple test:",
  }, function(choice, idx)
    if choice then
      print("Selected:", choice, "at index:", idx)
    else
      print("Cancelled")
    end
  end)
end

local function test_table_select()
  -- Test with table items (like the demo)
  local options = {
    { name = "Create file", icon = "📄" },
    { name = "Open file", icon = "📂" },
    { name = "Search", icon = "🔍" },
  }
  
  vim.ui.select(options, {
    prompt = "Table test:",
    format_item = function(item)
      return item.icon .. " " .. item.name
    end,
  }, function(choice, idx)
    if choice then
      print("Selected:", choice.name, "at index:", idx)
    else
      print("Cancelled")
    end
  end)
end

-- Create commands for testing
vim.api.nvim_create_user_command("TestSimpleSelect", test_simple_select, {
  desc = "Test simple select with strings"
})

vim.api.nvim_create_user_command("TestTableSelect", test_table_select, {
  desc = "Test select with table items"
})

return {
  test_simple_select = test_simple_select,
  test_table_select = test_table_select,
}
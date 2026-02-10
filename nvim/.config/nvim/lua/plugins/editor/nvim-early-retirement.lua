return {
  {
    "chrisgrieser/nvim-early-retirement",
    config = true,
    opts = {
      retirementAgeMins = 5,        -- Reduce from 10 to 5 minutes
      minimumBufferNum = 3,         -- Only retire when you have 3+ buffers
      notificationOnAutoClose = false, -- Reduce notification noise
    },
    event = "VeryLazy",
  },
}

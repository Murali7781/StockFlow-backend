const { Setting } = require('../models');
const { validateSetting } = require('../validators/settingValidators');

async function get(req, res) {
  const setting = await Setting.findOne({
    where: { organizationId: req.user.organizationId },
  });
  if (!setting) {
    return res.status(404).json({
      error: { code: 'SETTINGS_NOT_FOUND', message: 'Organization settings were not found' },
    });
  }
  return res.json({ data: setting });
}

async function update(req, res) {
  const values = validateSetting(req.body);
  const [updated] = await Setting.update(values, {
    where: { organizationId: req.user.organizationId },
    validate: true,
  });
  if (!updated) {
    const { defaultLowStockThreshold } = values;
    const [setting] = await Setting.findOrCreate({
      where: { organizationId: req.user.organizationId },
      defaults: {
        organizationId: req.user.organizationId,
        defaultLowStockThreshold,
      },
    });
    return res.json({ data: setting });
  }
  const setting = await Setting.findOne({
    where: { organizationId: req.user.organizationId },
  });
  return res.json({ data: setting });
}

module.exports = { get, update };

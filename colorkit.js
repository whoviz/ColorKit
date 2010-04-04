/* $Id: colorkit.js,v 1.0 2010/04/04 12:00:00 whoviz Exp $ */

Drupal.behaviors.color = function (context) {
  var i, colors, field_name;
  // This behavior attaches by ID, so is only valid once on a page.
  if ($('#colorkit_scheme_form .color-form.color-processed').size()) {
    return;
  }
  var form = $('#colorkit_scheme_form .color-form', context);
  var inputs = [];
  var hooks = [];
  var locks = [];
  var focused = null;

  // Add Farbtastic
  $(form).prepend('<div id="placeholder"></div>').addClass('color-processed');
  var farb = $.farbtastic('#placeholder');

  // Decode reference colors to HSL
  var reference = Drupal.settings.color.reference;
  for (i in reference) {
    reference[i] = farb.RGBToHSL(farb.unpack(reference[i]));
  }

  // Build preview
  var height = [];
  var width = [];
  // Loop through all defined gradients.
  for (i in Drupal.settings.gradients) {
    // Add element to display the gradient.
    $('#preview:not(.color-processed)').append('<div id="gradient-' + i + '"></div>');
    var gradient = $('#preview #gradient-' + i);
    // Add height of current gradient to the list (divided by 10).
    height.push(parseInt(gradient.css('height'), 10) / 10);
    // Add width of current gradient to the list (divided by 10).
    width.push(parseInt(gradient.css('width'), 10) / 10);
    // Add rows (or columns for horizontal gradients).
    // Each gradient line should have a height (or width for horizontal
    // gradients) of 10px (because we divided the height/width by 10 above).
    for (j = 0; j < (Drupal.settings.gradients[i]['direction'] == 'vertical' ? height[i] : width[i]); ++j) {
      gradient.append('<div class="gradient-line"></div>');
    }
  }
  $('#preview:not(.color-processed)').addClass('color-processed');

  // Fix preview background in IE6
  if (navigator.appVersion.match(/MSIE [0-6]\./)) {
    var e = $('#preview #img')[0];
    var image = e.currentStyle.backgroundImage;
    e.style.backgroundImage = 'none';
    e.style.filter = "progid:DXImageTransform.Microsoft.AlphaImageLoader(enabled=true, sizingMethod=crop, src='" + image.substring(5, image.length - 2) + "')";
  }

  // Set up colorScheme selector
  $('#edit-scheme', form).change(function () {
    var schemes = Drupal.settings.color.schemes, colorScheme = this.options[this.selectedIndex].value;
    if (colorScheme != '' && schemes[colorScheme]) {
      // Get colors of active scheme.
      colors = schemes[colorScheme];
      for (field_name in colors) {
        callback($('#edit-palette-' + field_name), colors[field_name], false, true);
      }
      preview();
    }
  });

  /**
   * Render the preview.
   */
  function preview() {
    // Solid background
    $('#preview', form).css('backgroundColor', $('#palette input[name="palette[base]"]', form).val());

    // Text preview
    $('#text', form).css('color', $('#palette input[name="palette[text]"]', form).val());
    $('#text a, #text h2', form).css('color', $('#palette input[name="palette[link]"]', form).val());

    // Set up gradients if there are some.
    var colorkit_start, colorkit_end;
    for (i in Drupal.settings.gradients) {
      colorkit_start = farb.unpack($('#palette input[name="palette[' + Drupal.settings.gradients[i]['colors'][0] + ']"]', form).val());
      colorkit_end = farb.unpack($('#palette input[name="palette[' + Drupal.settings.gradients[i]['colors'][1] + ']"]', form).val());
      if (colorkit_start && colorkit_end) {
      var delta = [];
        for (j in colorkit_start) {
          delta[j] = (colorkit_end[j] - colorkit_start[j]) / (Drupal.settings.gradients[i]['vertical'] ? height[i] : width[i]);

        }
        var accum = colorkit_start;
        // Render gradient lines.
        $('#gradient-' + i + ' > div', form).each(function () {
          for (j in accum) {
            accum[j] += delta[j];
          }
        this.style.backgroundColor = farb.pack(accum);
      });
    }
  }
  }

  /**
   * Shift a given color, using a reference pair (ref in HSL).
   *
   * This algorithm ensures relative ordering on the saturation and luminance
   * axes is preserved, and performs a simple hue shift.
   *
   * It is also symmetrical. If: shift_color(c, a, b) == d,
   *                        then shift_color(d, b, a) == c.
   */
  function shift_color(given, ref1, ref2) {
    // Convert to HSL
    given = farb.RGBToHSL(farb.unpack(given));

    // Hue: apply delta
    given[0] += ref2[0] - ref1[0];

    // Saturation: interpolate
    if (ref1[1] == 0 || ref2[1] == 0) {
      given[1] = ref2[1];
    }
    else {
      var d = ref1[1] / ref2[1];
      if (d > 1) {
        given[1] /= d;
      }
      else {
        given[1] = 1 - (1 - given[1]) * d;
      }
    }

    // Luminance: interpolate
    if (ref1[2] == 0 || ref2[2] == 0) {
      given[2] = ref2[2];
    }
    else {
      var d = ref1[2] / ref2[2];
      if (d > 1) {
        given[2] /= d;
      }
      else {
        given[2] = 1 - (1 - given[2]) * d;
      }
    }

    return farb.pack(farb.HSLToRGB(given));
  }

  /**
   * Callback for Farbtastic when a new color is chosen.
   */
  function callback(input, color, propagate, colorScheme) {
    var i, j, matched;
    // Set background/foreground color
    $(input).css({
      backgroundColor: color,
      'color': farb.RGBToHSL(farb.unpack(color))[2] > 0.5 ? '#000' : '#fff'
    });

    // Change input value
    if ($(input).val() && $(input).val() != color) {
      $(input).val(color);

      // Update locked values
      if (propagate) {
        i = input.i;
        for (j = i + 1; ; ++j) {
          if (!locks[j - 1] || $(locks[j - 1]).is('.unlocked')) break;
          matched = shift_color(color, reference[input.key], reference[inputs[j].key]);
          callback(inputs[j], matched, false);
        }
        for (j = i - 1; ; --j) {
          if (!locks[j] || $(locks[j]).is('.unlocked')) break;
          matched = shift_color(color, reference[input.key], reference[inputs[j].key]);
          callback(inputs[j], matched, false);
        }

        // Update preview
        preview();
      }

      // Reset colorScheme selector
      if (!colorScheme) {
        resetScheme();
      }
    }

  }

  /**
   * Reset the color scheme selector.
   */
  function resetScheme() {
    $('#edit-scheme', form).each(function () {
      this.selectedIndex = this.options.length - 1;
    });
  }

  // Focus the Farbtastic on a particular field.
  function focus() {
    var input = this;
    // Remove old bindings
    focused && $(focused).unbind('keyup', farb.updateValue)
        .unbind('keyup', preview).unbind('keyup', resetScheme)
        .parent().removeClass('item-selected');

    // Add new bindings
    focused = this;
    farb.linkTo(function (color) {
      callback(input, color, true, false);
    });
    farb.setColor(this.value);
    $(focused).keyup(farb.updateValue).keyup(preview).keyup(resetScheme)
      .parent().addClass('item-selected');
  }

  // Initialize color fields
  $('#palette input.form-text', form)
  .each(function () {
    // Extract palette field name
    this.key = this.id.substring(13);

    // Link to color picker temporarily to initialize.
    farb.linkTo(function () {}).setColor('#000').linkTo(this);

    // Add lock
    var i = inputs.length;
    if (inputs.length) {
      var lock = $('<div class="lock"></div>').toggle(
        function () {
          $(this).addClass('unlocked');
          $(hooks[i - 1]).attr('class',
            locks[i - 2] && $(locks[i - 2]).is(':not(.unlocked)') ? 'hook up' : 'hook'
          );
          $(hooks[i]).attr('class',
            locks[i] && $(locks[i]).is(':not(.unlocked)') ? 'hook down' : 'hook'
          );
        },
        function () {
          $(this).removeClass('unlocked');
          $(hooks[i - 1]).attr('class',
            locks[i - 2] && $(locks[i - 2]).is(':not(.unlocked)') ? 'hook both' : 'hook down'
          );
          $(hooks[i]).attr('class',
            locks[i] && $(locks[i]).is(':not(.unlocked)') ? 'hook both' : 'hook up'
          );
        }
      );
      $(this).after(lock);
      locks.push(lock);
    }

    // Add hook
    var hook = $('<div class="hook"></div>');
    $(this).after(hook);
    hooks.push(hook);

    $(this).parent().find('.lock').click();
    this.i = i;
    inputs.push(this);
  })
  .focus(focus);

  $('#palette label', form);

  // Focus first color
  focus.call(inputs[0]);

  // Render preview
  preview();
};

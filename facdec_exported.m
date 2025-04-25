classdef facdec_exported < matlab.apps.AppBase

    % Properties that correspond to app components
    properties (Access = public)
        UIFigure  matlab.ui.Figure
        Label     matlab.ui.control.Label
        Button    matlab.ui.control.Button
        UIAxes    matlab.ui.control.UIAxes
    end

    % Callbacks that handle component events
    methods (Access = private)

        % Button pushed function: Button
        function ButtonPushed(app, event)
            [a, b] = uigetfile({'*.jpg;*.png;*.bmp'}, 'Choose Picture');
            if isequal(a, 0)
                uialert(app.UIFigure, 'No picture chosen.', 'Alert');
                return;
            end

            c = fullfile(b, a);
            d = imfinfo(c);
            e = imread(c);

            if isfield(d, 'Orientation')
                switch d.Orientation
                    case 3
                        e = imrotate(e, 180);
                    case 6
                        e = imrotate(e, -90);
                    case 8
                        e = imrotate(e, 90);
                end
            end

            e = imresize(e, [256 256]);
            imshow(e, 'Parent', app.UIAxes);

            f = rgb2ycbcr(e);
            g = f(:,:,2);
            h = f(:,:,3);

            i = (g >= 77 & g <= 127) & (h >= 133 & h <= 173);
            [j, k] = size(i);
            l = false(size(i));
            l(1:round(j*0.6), :) = true;
            m = i & l;

            m = imfill(m, 'holes');
            m = bwareaopen(m, 100);
            n = regionprops(m, 'BoundingBox', 'Eccentricity');

            axes(app.UIAxes);
            imshow(e, 'Parent', app.UIAxes); hold(app.UIAxes, 'on');
            o = false;

            for p = 1:length(n)
                q = n(p).Eccentricity;
                if q < 0.9
                    r = n(p).BoundingBox;
                    s = imcrop(e, r);
                    t = rgb2gray(s);

                    t = double(t);
                    t = (t - min(t(:))) / (max(t(:)) - min(t(:))) * 255;
                    t = uint8(t);

                    u = t < 60;
                    u = bwareaopen(u, 20);
                    v = regionprops(u, 'BoundingBox');

                    w = (t > 70) & (t < 120);
                    w = bwareaopen(w, 20);
                    x = regionprops(w, 'BoundingBox');

                    y = t > 100;
                    y = bwareaopen(y, 20);
                    z = regionprops(y, 'BoundingBox');

                    if length(v) >= 2 && ~isempty(x) && ~isempty(z)
                        rectangle(app.UIAxes, 'Position', r, 'EdgeColor', 'g', 'LineWidth', 2);
                        o = true;
                    end
                end
            end

            if o
                app.Label.Text = 'Face Found';
                app.Label.FontColor = [0, 1, 0];  % Green for "Face Found"
            else
                app.Label.Text = 'Face Not Found';
                app.Label.FontColor = [1, 0, 0];  % Red for "Face Not Found"
            end
        end
    end

    % Component initialization
    methods (Access = private)

        % Create UIFigure and components
        function createComponents(app)

            % Create UIFigure and hide until all components are created
            app.UIFigure = uifigure('Visible', 'off');
            app.UIFigure.Position = [100 100 640 480];
            app.UIFigure.Name = 'Face Detection App';

            % Create UIAxes
            app.UIAxes = uiaxes(app.UIFigure);
            title(app.UIAxes, 'Face Detection Result')
            app.UIAxes.XTick = [];
            app.UIAxes.YTick = [];
            app.UIAxes.Tag = 'UIAxes';
            app.UIAxes.Position = [76 180 490 301];

            % Create Button
            app.Button = uibutton(app.UIFigure, 'push');
            app.Button.ButtonPushedFcn = createCallbackFcn(app, @ButtonPushed, true);
            app.Button.Tag = 'ChooseImageButton';
            app.Button.Position = [271 80 100 40];
            app.Button.Text = 'Choose Image';
            app.Button.FontSize = 14;
            app.Button.BackgroundColor = [0.2 0.6 0.2];  % Green background for button

            % Create Label for result
            app.Label = uilabel(app.UIFigure);
            app.Label.Tag = 'ResultLabel';
            app.Label.Position = [271 130 100 30];
            app.Label.Text = 'Result will appear here';
            app.Label.FontSize = 16;
            app.Label.FontColor = [0, 0, 0];  % Default color

            % Show the figure after all components are created
            app.UIFigure.Visible = 'on';
        end
    end

    % App creation and deletion
    methods (Access = public)

        % Construct app
        function app = facdec_exported

            % Create UIFigure and components
            createComponents(app)

            % Register the app with App Designer
            registerApp(app, app.UIFigure)

            if nargout == 0
                clear app
            end
        end

        % Code that executes before app deletion
        function delete(app)

            % Delete UIFigure when app is deleted
            delete(app.UIFigure)
        end
    end
end

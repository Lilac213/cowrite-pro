// vite.config.dev.ts
import { defineConfig, loadConfigFromFile } from "file:///data/shadcn/node_modules/.pnpm/vite@5.4.21_@types+node@22.19.7_terser@5.46.0/node_modules/vite/dist/node/index.js";
import path from "path";
import {
  makeTagger,
  injectedGuiListenerPlugin,
  injectOnErrorPlugin,
  monitorPlugin
} from "file:///data/shadcn/node_modules/.pnpm/miaoda-sc-plugin@1.0.52_vite@5.4.21_@types+node@22.19.7_terser@5.46.0_/node_modules/miaoda-sc-plugin/dist/index.js";
var __vite_injected_original_dirname = "/workspace/app-9bwpferlujnl";
var env = { command: "serve", mode: "development" };
var configFile = path.resolve(__vite_injected_original_dirname, "vite.config.ts");
var result = await loadConfigFromFile(env, configFile);
var userConfig = result?.config;
var vite_config_dev_default = defineConfig({
  ...userConfig,
  plugins: [
    makeTagger(),
    injectedGuiListenerPlugin({
      path: "https://miaoda-resource-static.s3cdn.medo.dev/common/v2/injected.js"
    }),
    injectOnErrorPlugin(),
    ...userConfig?.plugins || [],
    {
      name: "hmr-toggle",
      configureServer(server) {
        let hmrEnabled = true;
        const _send = server.ws.send;
        server.ws.send = (payload) => {
          if (hmrEnabled) {
            return _send.call(server.ws, payload);
          } else {
            console.log("[HMR disabled] skipped payload:", payload.type);
          }
        };
        server.middlewares.use("/innerapi/v1/sourcecode/__hmr_off", (req, res) => {
          hmrEnabled = false;
          let body = {
            status: 0,
            msg: "HMR disabled"
          };
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        });
        server.middlewares.use("/innerapi/v1/sourcecode/__hmr_on", (req, res) => {
          hmrEnabled = true;
          let body = {
            status: 0,
            msg: "HMR enabled"
          };
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        });
        server.middlewares.use("/innerapi/v1/sourcecode/__hmr_reload", (req, res) => {
          if (hmrEnabled) {
            server.ws.send({
              type: "full-reload",
              path: "*"
              // 整页刷新
            });
          }
          res.statusCode = 200;
          let body = {
            status: 0,
            msg: "Manual full reload triggered"
          };
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(body));
        });
      },
      load(id) {
        if (id === "virtual:after-update") {
          return `
        if (import.meta.hot) {
          import.meta.hot.on('vite:afterUpdate', () => {
            window.postMessage(
              {
                type: 'editor-update'
              },
              '*'
            );
          });
        }
      `;
        }
      },
      transformIndexHtml(html) {
        return {
          html,
          tags: [
            {
              tag: "script",
              attrs: {
                type: "module",
                src: "/@id/virtual:after-update"
              },
              injectTo: "body"
            }
          ]
        };
      }
    },
    ,
    monitorPlugin(
      {
        scriptSrc: "https://miaoda-resource-static.s3cdn.medo.dev/sentry/browser.sentry.min.js",
        sentryDsn: "https://e3c07b90fcb5207f333d50ac24a99d3e@sentry.miaoda.cn/233",
        environment: "undefined",
        appId: "app-9bwpferlujnl"
      }
    )
  ]
});
export {
  vite_config_dev_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuZGV2LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL3dvcmtzcGFjZS9hcHAtOWJ3cGZlcmx1am5sXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvd29ya3NwYWNlL2FwcC05YndwZmVybHVqbmwvdml0ZS5jb25maWcuZGV2LnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy93b3Jrc3BhY2UvYXBwLTlid3BmZXJsdWpubC92aXRlLmNvbmZpZy5kZXYudHNcIjtcbiAgICBpbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRDb25maWdGcm9tRmlsZSB9IGZyb20gXCJ2aXRlXCI7XG4gICAgaW1wb3J0IHR5cGUgeyBQbHVnaW4sIENvbmZpZ0VudiB9IGZyb20gXCJ2aXRlXCI7XG4gICAgaW1wb3J0IHRhaWx3aW5kY3NzIGZyb20gXCJ0YWlsd2luZGNzc1wiO1xuICAgIGltcG9ydCBhdXRvcHJlZml4ZXIgZnJvbSBcImF1dG9wcmVmaXhlclwiO1xuICAgIGltcG9ydCBmcyBmcm9tIFwiZnMvcHJvbWlzZXNcIjtcbiAgICBpbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuICAgIGltcG9ydCB7XG4gICAgICBtYWtlVGFnZ2VyLFxuICAgICAgaW5qZWN0ZWRHdWlMaXN0ZW5lclBsdWdpbixcbiAgICAgIGluamVjdE9uRXJyb3JQbHVnaW4sXG4gICAgICBtb25pdG9yUGx1Z2luXG4gICAgfSBmcm9tIFwibWlhb2RhLXNjLXBsdWdpblwiO1xuXG4gICAgY29uc3QgZW52OiBDb25maWdFbnYgPSB7IGNvbW1hbmQ6IFwic2VydmVcIiwgbW9kZTogXCJkZXZlbG9wbWVudFwiIH07XG4gICAgY29uc3QgY29uZmlnRmlsZSA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwidml0ZS5jb25maWcudHNcIik7XG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgbG9hZENvbmZpZ0Zyb21GaWxlKGVudiwgY29uZmlnRmlsZSk7XG4gICAgY29uc3QgdXNlckNvbmZpZyA9IHJlc3VsdD8uY29uZmlnO1xuXG4gICAgZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgICAgIC4uLnVzZXJDb25maWcsXG4gICAgICBwbHVnaW5zOiBbXG4gICAgICAgIG1ha2VUYWdnZXIoKSxcbiAgICAgICAgaW5qZWN0ZWRHdWlMaXN0ZW5lclBsdWdpbih7XG4gICAgICAgICAgcGF0aDogJ2h0dHBzOi8vbWlhb2RhLXJlc291cmNlLXN0YXRpYy5zM2Nkbi5tZWRvLmRldi9jb21tb24vdjIvaW5qZWN0ZWQuanMnXG4gICAgICAgIH0pLFxuICAgICAgICBpbmplY3RPbkVycm9yUGx1Z2luKCksXG4gICAgICAgIC4uLih1c2VyQ29uZmlnPy5wbHVnaW5zIHx8IFtdKSxcbiAgICAgICAgXG57XG4gIG5hbWU6ICdobXItdG9nZ2xlJyxcbiAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgIGxldCBobXJFbmFibGVkID0gdHJ1ZTtcblxuICAgIC8vIFx1NTMwNVx1ODhDNVx1NTM5Rlx1Njc2NVx1NzY4NCBzZW5kIFx1NjVCOVx1NkNENVxuICAgIGNvbnN0IF9zZW5kID0gc2VydmVyLndzLnNlbmQ7XG4gICAgc2VydmVyLndzLnNlbmQgPSAocGF5bG9hZCkgPT4ge1xuICAgICAgaWYgKGhtckVuYWJsZWQpIHtcbiAgICAgICAgcmV0dXJuIF9zZW5kLmNhbGwoc2VydmVyLndzLCBwYXlsb2FkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdbSE1SIGRpc2FibGVkXSBza2lwcGVkIHBheWxvYWQ6JywgcGF5bG9hZC50eXBlKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gXHU2M0QwXHU0RjlCXHU2M0E1XHU1M0UzXHU1MjA3XHU2MzYyIEhNUlxuICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoJy9pbm5lcmFwaS92MS9zb3VyY2Vjb2RlL19faG1yX29mZicsIChyZXEsIHJlcykgPT4ge1xuICAgICAgaG1yRW5hYmxlZCA9IGZhbHNlO1xuICAgICAgbGV0IGJvZHkgPSB7XG4gICAgICAgICAgc3RhdHVzOiAwLFxuICAgICAgICAgIG1zZzogJ0hNUiBkaXNhYmxlZCdcbiAgICAgIH07XG4gICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeShib2R5KSk7XG4gICAgfSk7XG5cbiAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKCcvaW5uZXJhcGkvdjEvc291cmNlY29kZS9fX2htcl9vbicsIChyZXEsIHJlcykgPT4ge1xuICAgICAgaG1yRW5hYmxlZCA9IHRydWU7XG4gICAgICBsZXQgYm9keSA9IHtcbiAgICAgICAgICBzdGF0dXM6IDAsXG4gICAgICAgICAgbXNnOiAnSE1SIGVuYWJsZWQnXG4gICAgICB9O1xuICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoYm9keSkpO1xuICAgIH0pO1xuXG4gICAgLy8gXHU2Q0U4XHU1MThDXHU0RTAwXHU0RTJBIEhUVFAgQVBJXHVGRjBDXHU3NTI4XHU2NzY1XHU2MjRCXHU1MkE4XHU4OUU2XHU1M0QxXHU0RTAwXHU2QjIxXHU2NTc0XHU0RjUzXHU1MjM3XHU2NUIwXG4gICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgnL2lubmVyYXBpL3YxL3NvdXJjZWNvZGUvX19obXJfcmVsb2FkJywgKHJlcSwgcmVzKSA9PiB7XG4gICAgICBpZiAoaG1yRW5hYmxlZCkge1xuICAgICAgICBzZXJ2ZXIud3Muc2VuZCh7XG4gICAgICAgICAgdHlwZTogJ2Z1bGwtcmVsb2FkJyxcbiAgICAgICAgICBwYXRoOiAnKicsIC8vIFx1NjU3NFx1OTg3NVx1NTIzN1x1NjVCMFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIHJlcy5zdGF0dXNDb2RlID0gMjAwO1xuICAgICAgbGV0IGJvZHkgPSB7XG4gICAgICAgICAgc3RhdHVzOiAwLFxuICAgICAgICAgIG1zZzogJ01hbnVhbCBmdWxsIHJlbG9hZCB0cmlnZ2VyZWQnXG4gICAgICB9O1xuICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoYm9keSkpO1xuICAgIH0pO1xuICB9LFxuICBsb2FkKGlkKSB7XG4gICAgaWYgKGlkID09PSAndmlydHVhbDphZnRlci11cGRhdGUnKSB7XG4gICAgICByZXR1cm4gYFxuICAgICAgICBpZiAoaW1wb3J0Lm1ldGEuaG90KSB7XG4gICAgICAgICAgaW1wb3J0Lm1ldGEuaG90Lm9uKCd2aXRlOmFmdGVyVXBkYXRlJywgKCkgPT4ge1xuICAgICAgICAgICAgd2luZG93LnBvc3RNZXNzYWdlKFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2VkaXRvci11cGRhdGUnXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICcqJ1xuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgYDtcbiAgICB9XG4gIH0sXG4gIHRyYW5zZm9ybUluZGV4SHRtbChodG1sKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGh0bWwsXG4gICAgICB0YWdzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICB0YWc6ICdzY3JpcHQnLFxuICAgICAgICAgIGF0dHJzOiB7XG4gICAgICAgICAgICB0eXBlOiAnbW9kdWxlJyxcbiAgICAgICAgICAgIHNyYzogJy9AaWQvdmlydHVhbDphZnRlci11cGRhdGUnXG4gICAgICAgICAgfSxcbiAgICAgICAgICBpbmplY3RUbzogJ2JvZHknXG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9O1xuICB9XG59LFxuLFxuICAgICAgICBtb25pdG9yUGx1Z2luKFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHNjcmlwdFNyYzogJ2h0dHBzOi8vbWlhb2RhLXJlc291cmNlLXN0YXRpYy5zM2Nkbi5tZWRvLmRldi9zZW50cnkvYnJvd3Nlci5zZW50cnkubWluLmpzJyxcbiAgICAgICAgICAgIHNlbnRyeURzbjogJ2h0dHBzOi8vZTNjMDdiOTBmY2I1MjA3ZjMzM2Q1MGFjMjRhOTlkM2VAc2VudHJ5Lm1pYW9kYS5jbi8yMzMnLFxuICAgICAgICAgICAgZW52aXJvbm1lbnQ6ICd1bmRlZmluZWQnLFxuICAgICAgICAgICAgYXBwSWQ6ICdhcHAtOWJ3cGZlcmx1am5sJ1xuICAgICAgICAgIH1cbiAgICAgICAgKVxuICAgICAgXVxuICAgIH0pO1xuICAgICJdLAogICJtYXBwaW5ncyI6ICI7QUFDSSxTQUFTLGNBQWMsMEJBQTBCO0FBS2pELE9BQU8sVUFBVTtBQUNqQjtBQUFBLEVBQ0U7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxPQUNLO0FBWlgsSUFBTSxtQ0FBbUM7QUFjckMsSUFBTSxNQUFpQixFQUFFLFNBQVMsU0FBUyxNQUFNLGNBQWM7QUFDL0QsSUFBTSxhQUFhLEtBQUssUUFBUSxrQ0FBVyxnQkFBZ0I7QUFDM0QsSUFBTSxTQUFTLE1BQU0sbUJBQW1CLEtBQUssVUFBVTtBQUN2RCxJQUFNLGFBQWEsUUFBUTtBQUUzQixJQUFPLDBCQUFRLGFBQWE7QUFBQSxFQUMxQixHQUFHO0FBQUEsRUFDSCxTQUFTO0FBQUEsSUFDUCxXQUFXO0FBQUEsSUFDWCwwQkFBMEI7QUFBQSxNQUN4QixNQUFNO0FBQUEsSUFDUixDQUFDO0FBQUEsSUFDRCxvQkFBb0I7QUFBQSxJQUNwQixHQUFJLFlBQVksV0FBVyxDQUFDO0FBQUEsSUFFcEM7QUFBQSxNQUNFLE1BQU07QUFBQSxNQUNOLGdCQUFnQixRQUFRO0FBQ3RCLFlBQUksYUFBYTtBQUdqQixjQUFNLFFBQVEsT0FBTyxHQUFHO0FBQ3hCLGVBQU8sR0FBRyxPQUFPLENBQUMsWUFBWTtBQUM1QixjQUFJLFlBQVk7QUFDZCxtQkFBTyxNQUFNLEtBQUssT0FBTyxJQUFJLE9BQU87QUFBQSxVQUN0QyxPQUFPO0FBQ0wsb0JBQVEsSUFBSSxtQ0FBbUMsUUFBUSxJQUFJO0FBQUEsVUFDN0Q7QUFBQSxRQUNGO0FBR0EsZUFBTyxZQUFZLElBQUkscUNBQXFDLENBQUMsS0FBSyxRQUFRO0FBQ3hFLHVCQUFhO0FBQ2IsY0FBSSxPQUFPO0FBQUEsWUFDUCxRQUFRO0FBQUEsWUFDUixLQUFLO0FBQUEsVUFDVDtBQUNBLGNBQUksVUFBVSxnQkFBZ0Isa0JBQWtCO0FBQ2hELGNBQUksSUFBSSxLQUFLLFVBQVUsSUFBSSxDQUFDO0FBQUEsUUFDOUIsQ0FBQztBQUVELGVBQU8sWUFBWSxJQUFJLG9DQUFvQyxDQUFDLEtBQUssUUFBUTtBQUN2RSx1QkFBYTtBQUNiLGNBQUksT0FBTztBQUFBLFlBQ1AsUUFBUTtBQUFBLFlBQ1IsS0FBSztBQUFBLFVBQ1Q7QUFDQSxjQUFJLFVBQVUsZ0JBQWdCLGtCQUFrQjtBQUNoRCxjQUFJLElBQUksS0FBSyxVQUFVLElBQUksQ0FBQztBQUFBLFFBQzlCLENBQUM7QUFHRCxlQUFPLFlBQVksSUFBSSx3Q0FBd0MsQ0FBQyxLQUFLLFFBQVE7QUFDM0UsY0FBSSxZQUFZO0FBQ2QsbUJBQU8sR0FBRyxLQUFLO0FBQUEsY0FDYixNQUFNO0FBQUEsY0FDTixNQUFNO0FBQUE7QUFBQSxZQUNSLENBQUM7QUFBQSxVQUNIO0FBQ0EsY0FBSSxhQUFhO0FBQ2pCLGNBQUksT0FBTztBQUFBLFlBQ1AsUUFBUTtBQUFBLFlBQ1IsS0FBSztBQUFBLFVBQ1Q7QUFDQSxjQUFJLFVBQVUsZ0JBQWdCLGtCQUFrQjtBQUNoRCxjQUFJLElBQUksS0FBSyxVQUFVLElBQUksQ0FBQztBQUFBLFFBQzlCLENBQUM7QUFBQSxNQUNIO0FBQUEsTUFDQSxLQUFLLElBQUk7QUFDUCxZQUFJLE9BQU8sd0JBQXdCO0FBQ2pDLGlCQUFPO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFFBWVQ7QUFBQSxNQUNGO0FBQUEsTUFDQSxtQkFBbUIsTUFBTTtBQUN2QixlQUFPO0FBQUEsVUFDTDtBQUFBLFVBQ0EsTUFBTTtBQUFBLFlBQ0o7QUFBQSxjQUNFLEtBQUs7QUFBQSxjQUNMLE9BQU87QUFBQSxnQkFDTCxNQUFNO0FBQUEsZ0JBQ04sS0FBSztBQUFBLGNBQ1A7QUFBQSxjQUNBLFVBQVU7QUFBQSxZQUNaO0FBQUEsVUFDRjtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLElBQ0E7QUFBQSxJQUNRO0FBQUEsTUFDRTtBQUFBLFFBQ0UsV0FBVztBQUFBLFFBQ1gsV0FBVztBQUFBLFFBQ1gsYUFBYTtBQUFBLFFBQ2IsT0FBTztBQUFBLE1BQ1Q7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==

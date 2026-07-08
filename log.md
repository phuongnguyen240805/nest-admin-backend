  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

  File "/usr/local/lib/python3.12/site-packages/tenacity/asyncio/__init__.py", line 153, in iter

    result = await action(retry_state)

             ^^^^^^^^^^^^^^^^^^^^^^^^^

  File "/usr/local/lib/python3.12/site-packages/tenacity/_utils.py", line 99, in inner

    return call(*args, **kwargs)

           ^^^^^^^^^^^^^^^^^^^^^

  File "/usr/local/lib/python3.12/site-packages/tenacity/__init__.py", line 420, in exc_check

    raise retry_exc.reraise()

          ^^^^^^^^^^^^^^^^^^^

  File "/usr/local/lib/python3.12/site-packages/tenacity/__init__.py", line 187, in reraise

    raise self.last_attempt.result()

          ^^^^^^^^^^^^^^^^^^^^^^^^^^

  File "/usr/local/lib/python3.12/concurrent/futures/_base.py", line 449, in result

    return self.__get_result()

           ^^^^^^^^^^^^^^^^^^^

  File "/usr/local/lib/python3.12/concurrent/futures/_base.py", line 401, in __get_result

    raise self._exception

  File "/usr/local/lib/python3.12/site-packages/tenacity/asyncio/__init__.py", line 114, in __call__

    result = await fn(*args, **kwargs)

             ^^^^^^^^^^^^^^^^^^^^^^^^^

  File "/usr/local/lib/python3.12/site-packages/google/genai/_api_client.py", line 1281, in _async_request_once

    await errors.APIError.raise_for_async_response(response)

  File "/usr/local/lib/python3.12/site-packages/google/genai/errors.py", line 203, in raise_for_async_response

    await cls.raise_error_async(status_code, response_json, response)

  File "/usr/local/lib/python3.12/site-packages/google/genai/errors.py", line 227, in raise_error_async

    raise ServerError(status_code, response_json, response)

google.genai.errors.ServerError: 503 Service Unavailable. {'message': '{\n  "error": {\n    "code": 503,\n    "message": "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",\n    "status": "UNAVAILABLE"\n  }\n}\n', 'status': 'Service Unavailable'}

INFO:     connection closed

[TOKEN USAGE] provider=gemini model=gemini-3-flash-preview | input=10319 output=4303 cache_read=2023 cache_write=0 total=16645 cache_hit_rate=16.39% cost=$0.0182

Error in variant 1: 503 Service Unavailable. {'message': '{\n  "error": {\n    "code": 503,\n    "message": "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",\n    "status": "UNAVAILABLE"\n  }\n}\n', 'status': 'Service Unavailable'}

Variant 1 error: 503 Service Unavailable. {'message': '{\n  "error": {\n    "code": 503,\n    "message": "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",\n    "status": "UNAVAILABLE"\n  }\n}\n', 'status': 'Service Unavailable'}

Error generating code. Please contact support.
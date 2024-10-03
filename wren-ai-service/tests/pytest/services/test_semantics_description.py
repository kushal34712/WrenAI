from unittest.mock import AsyncMock

import pytest

from src.web.v1.services.semantics_description import SemanticsDescription


@pytest.fixture
def semantics_description_service():
    mock_pipeline = AsyncMock()
    mock_pipeline.run.return_value = {
        "normalize": {
            "model1": {
                "columns": [],
                "properties": {"description": "Test description"},
            }
        }
    }

    pipelines = {"semantics_description": mock_pipeline}
    return SemanticsDescription(pipelines=pipelines)


@pytest.mark.asyncio
async def test_generate_semantics_description(
    semantics_description_service: SemanticsDescription,
):
    request = SemanticsDescription.Request(
        user_prompt="Describe the model",
        selected_models=["model1"],
        mdl='{"models": [{"name": "model1", "columns": []}]}',
    )
    request.id = "test_id"

    response = await semantics_description_service.generate(request)

    assert response.id == "test_id"
    assert response.status == "finished"
    assert response.response == {
        "model1": {
            "columns": [],
            "properties": {"description": "Test description"},
        }
    }
    assert response.error is None


@pytest.mark.asyncio
async def test_generate_semantics_description_with_invalid_mdl(
    semantics_description_service: SemanticsDescription,
):
    request = SemanticsDescription.Request(
        user_prompt="Describe the model",
        selected_models=["model1"],
        mdl="invalid_json",
    )
    request.id = "test_id"

    response = await semantics_description_service.generate(request)

    assert response.id == "test_id"
    assert response.status == "failed"
    assert response.response is None
    assert response.error.code == "OTHERS"
    assert "Failed to parse MDL" in response.error.message


@pytest.mark.asyncio
async def test_generate_semantics_description_with_exception(
    semantics_description_service: SemanticsDescription,
):
    request = SemanticsDescription.Request(
        user_prompt="Describe the model",
        selected_models=["model1"],
        mdl='{"models": [{"name": "model1", "columns": []}]}',
    )
    request.id = "test_id"

    semantics_description_service._pipelines[
        "semantics_description"
    ].run.side_effect = Exception("Test exception")

    response = await semantics_description_service.generate(request)

    assert response.id == "test_id"
    assert response.status == "failed"
    assert response.response is None
    assert response.error.code == "OTHERS"
    assert (
        "An error occurred during semantics description generation"
        in response.error.message
    )


def test_get_semantics_description_result(
    semantics_description_service: SemanticsDescription,
):
    request = SemanticsDescription.Request()
    request.id = "test_id"

    expected_response = SemanticsDescription.Response(
        id="test_id",
        status="finished",
        response={"model1": {"description": "Test description"}},
    )
    semantics_description_service._cache["test_id"] = expected_response

    result = semantics_description_service[request]

    assert result == expected_response


def test_get_non_existent_semantics_description_result(
    semantics_description_service: SemanticsDescription,
):
    request = SemanticsDescription.Request()
    request.id = "non_existent_id"

    result = semantics_description_service[request]

    assert result.id == "non_existent_id"
    assert result.status == "failed"
    assert result.response is None
    assert result.error.code == "OTHERS"
    assert "not found" in result.error.message
